import 'server-only'

import { err, ok, type AppError, type Result } from '@/core/errors'
import { withRls } from '@/core/db/with-rls'
import { isAtsDomain } from '@/core/domains/ats-domains'
import { ApplicationId, type UserId } from '@/core/types/ids'
import type { CanonicalStatus } from '@/generated/prisma/client'
import { meetsThreshold } from '@/features/classifier/thresholds'
import type { ClassifyEmailOutput } from '@/features/classifier/service'
import type { MatchEmailOutput } from '@/features/matcher/schema'

import type { ParsedEmail } from './gmail-client'

export type ApplicationImportDraft = {
  companyName: string
  companyDomain: string | null
  roleTitle: string
  canonicalStatus: CanonicalStatus
  currentStage: string
  rejectedAt: Date | null
  rejectionReason: string | null
}

const GENERIC_JOB_ALERT_DOMAINS = new Set([
  'glassdoor.com',
  'indeed.com',
  'linkedin.com',
])

export function inferApplicationDraftFromEmail(
  parsed: ParsedEmail,
  classification: ClassifyEmailOutput,
): ApplicationImportDraft | null {
  const subject = normalizeSpaces(parsed.subject)
  const body = normalizeSpaces(parsed.bodyExcerpt)
  const combined = `${subject} ${body}`

  if (isGenericJobAlert(parsed.fromDomain, combined)) return null
  if (isIncompleteApplicationReminder(combined)) return null
  if (!hasStrongApplicationSignal(combined, classification)) return null

  const companyName =
    extractCompanyFromApplicationSubject(subject) ??
    extractCompanyFromApplicationBody(body) ??
    companyNameFromDomain(parsed.fromDomain)
  const roleTitle =
    extractRoleFromApplicationSubject(subject) ??
    extractRoleFromApplicationBody(body)

  if (!companyName || !roleTitle) return null

  const rejected = isRejectionSignal(combined, classification)
  const interviewing = !rejected && isInterviewSignal(combined, classification)

  return {
    companyName,
    companyDomain: domainForCompany(parsed.fromDomain),
    roleTitle,
    canonicalStatus: rejected ? 'rejected' : interviewing ? 'interviewing' : 'applied',
    currentStage: rejected
      ? 'Rejected'
      : interviewing
        ? 'Interview requested'
        : 'Application received',
    rejectedAt: rejected ? parsed.receivedAt : null,
    rejectionReason: rejected
      ? 'Imported from Gmail: application update indicated the company is not moving forward.'
      : null,
  }
}

export function shouldAutoClearClassification(
  classification: ClassifyEmailOutput,
  match: MatchEmailOutput,
): boolean {
  if (classification.label !== 'noise' && classification.label !== 'unmatched') return false

  // If the importer linked the email to an application, the useful outcome is
  // already represented on the application timeline; the email itself does not
  // need a review-queue task. Without an application link, keep the existing
  // per-label threshold guard.
  return match.applicationId !== null || meetsThreshold(classification.label, classification.confidence)
}

export async function ensureApplicationFromEmail(
  userId: UserId,
  emailId: number,
  parsed: ParsedEmail,
  match: MatchEmailOutput,
  classification: ClassifyEmailOutput,
): Promise<Result<MatchEmailOutput, AppError>> {
  if (match.applicationId !== null) return ok(match)

  const draft = inferApplicationDraftFromEmail(parsed, classification)
  if (!draft) return ok(match)

  const result = await withRls(userId, async (tx) => {
    const company = await tx.company.upsert({
      where: {
        userId_name: {
          userId: Number(userId),
          name: draft.companyName,
        },
      },
      create: {
        userId: Number(userId),
        name: draft.companyName,
        domain: draft.companyDomain,
      },
      update: {
        domain: draft.companyDomain ?? undefined,
      },
      select: { id: true },
    })

    const existing = await tx.application.findFirst({
      where: {
        userId: Number(userId),
        companyId: company.id,
        roleTitle: { equals: draft.roleTitle, mode: 'insensitive' },
      },
      select: { id: true },
    })

    const application = existing ?? await tx.application.create({
      data: {
        userId: Number(userId),
        companyId: company.id,
        roleTitle: draft.roleTitle,
        source: 'direct',
        appliedAt: parsed.receivedAt,
        canonicalStatus: draft.canonicalStatus,
        currentStage: draft.currentStage,
        rejectedAt: draft.rejectedAt,
        rejectionReason: draft.rejectionReason,
        lastActivityAt: draft.rejectedAt ?? parsed.receivedAt,
        tags: ['gmail-import'],
      },
      select: { id: true },
    })

    await tx.email.update({
      where: { id: emailId },
      data: { applicationId: application.id },
    })

    await tx.event.create({
      data: {
        userId: Number(userId),
        applicationId: application.id,
        type: 'created',
        source: 'gmail',
        undoable: false,
        occurredAt: parsed.receivedAt,
        data: {
          importedFrom: 'gmail',
          gmailMessageId: parsed.gmailMessageId,
          gmailThreadId: parsed.gmailThreadId,
        },
      },
    })

    return application.id
  })

  if (result.isErr()) return err(result.error)
  return ok({ applicationId: ApplicationId(result.value) })
}

function normalizeSpaces(input: string): string {
  return input.replace(/\s+/g, ' ').trim()
}

function isGenericJobAlert(fromDomain: string, text: string): boolean {
  const lower = text.toLowerCase()
  return (
    GENERIC_JOB_ALERT_DOMAINS.has(fromDomain) &&
    (
      lower.includes('your job alert') ||
      lower.includes('new jobs match your preferences') ||
      /and \d+ more jobs/i.test(text) ||
      /^new jobs in /i.test(text)
    )
  )
}

function isIncompleteApplicationReminder(text: string): boolean {
  const lower = text.toLowerCase()
  return lower.includes('complete your application') && lower.includes('started your application')
}

function hasStrongApplicationSignal(
  text: string,
  classification: ClassifyEmailOutput,
): boolean {
  return (
    classification.label === 'rejection' ||
    classification.label === 'interview_invite' ||
    /thank you for (your )?application/i.test(text) ||
    /thank you for applying/i.test(text) ||
    /thanks for applying/i.test(text) ||
    /application received/i.test(text) ||
    /your application for/i.test(text) ||
    /received your application/i.test(text) ||
    /submitted your application/i.test(text)
  )
}

function extractCompanyFromApplicationSubject(subject: string): string | null {
  const applicationFor = subject.match(/your application for (?:our )?.+? role at ([^.!|]+)/i)
  if (applicationFor?.[1]) return cleanCompanyName(applicationFor[1])

  const applicationTo = subject.match(/(?:thank you for your application to|thank you for applying to|thanks for applying to)\s+([^!.|]+)/i)
  if (applicationTo?.[1]) return cleanCompanyName(applicationTo[1])

  const pipeReceived = subject.match(/^([^|]+)\|\s*application received/i)
  if (pipeReceived?.[1]) return cleanCompanyName(pipeReceived[1])

  const dashedWorkflow = subject.match(/^([^-]+)-\s*(.+?)\s*-\s*(next steps|followup|follow-up)/i)
  if (dashedWorkflow?.[1]) return cleanCompanyName(dashedWorkflow[1])

  return null
}

function extractRoleFromApplicationSubject(subject: string): string | null {
  const applicationFor = subject.match(/your application for (?:our )?(.+?) role at /i)
  if (applicationFor?.[1]) return cleanRoleTitle(applicationFor[1])

  const applicationForAt = subject.match(/your application for (.+?) at [^.!|]+/i)
  if (applicationForAt?.[1]) return cleanRoleTitle(applicationForAt[1])

  const applicationReceivedFor = subject.match(/application received for (.+)$/i)
  if (applicationReceivedFor?.[1]) return cleanRoleTitle(applicationReceivedFor[1])

  const shopee = subject.match(/thank you for applying to ([^-]+)-\s*(.+)$/i)
  if (shopee?.[2]) return cleanRoleTitle(shopee[2])

  const dashedWorkflow = subject.match(/^[^-]+-\s*(.+?)\s*-\s*(next steps|followup|follow-up)/i)
  if (dashedWorkflow?.[1]) return cleanRoleTitle(dashedWorkflow[1])

  return null
}

function extractCompanyFromApplicationBody(body: string): string | null {
  const applicationTo = body.match(/application to the .+? position at ([^.]+)/i)
  if (applicationTo?.[1]) return cleanCompanyName(applicationTo[1])

  const interestIn = body.match(/interest in ([A-Z][A-Za-z0-9& .-]{1,60})[.!]/)
  if (interestIn?.[1]) return cleanCompanyName(interestIn[1])

  return null
}

function extractRoleFromApplicationBody(body: string): string | null {
  const receivedFor = body.match(/received your application for (.+?)(?:,|\.| and |$)/i)
  if (receivedFor?.[1]) return cleanRoleTitle(receivedFor[1])

  const submittedFor = body.match(/submitting your application for the (.+?) role/i)
  if (submittedFor?.[1]) return cleanRoleTitle(submittedFor[1])

  const applicationTo = body.match(/application to the (.+?) position at /i)
  if (applicationTo?.[1]) return cleanRoleTitle(applicationTo[1])

  const screeningFor = body.match(/screening form for the (.+?) position/i)
  if (screeningFor?.[1]) return cleanRoleTitle(screeningFor[1])

  return null
}

function isRejectionSignal(text: string, classification: ClassifyEmailOutput): boolean {
  return (
    classification.label === 'rejection' ||
    /not selected/i.test(text) ||
    /regret to inform/i.test(text) ||
    /decided to move forward with another/i.test(text) ||
    /going in a direction/i.test(text) ||
    /not moving forward/i.test(text)
  )
}

function isInterviewSignal(text: string, classification: ClassifyEmailOutput): boolean {
  return (
    classification.label === 'interview_invite' ||
    /video interview/i.test(text) ||
    /schedule below/i.test(text) ||
    /30-minute discussion/i.test(text)
  )
}

function companyNameFromDomain(fromDomain: string): string | null {
  if (!fromDomain || isAtsDomain(fromDomain)) return null
  const apex = fromDomain.split('.').at(-2)
  if (!apex) return null
  if (apex.length <= 5) return apex.toUpperCase()
  return apex.slice(0, 1).toUpperCase() + apex.slice(1)
}

function domainForCompany(fromDomain: string): string | null {
  if (!fromDomain || isAtsDomain(fromDomain)) return null
  return fromDomain
}

function cleanCompanyName(raw: string): string {
  return normalizeSpaces(raw)
    .replace(/^the\s+/i, '')
    .replace(/\s+role$/i, '')
    .replace(/[.!]+$/g, '')
    .trim()
}

function cleanRoleTitle(raw: string): string {
  return normalizeSpaces(raw)
    .replace(/^the\s+/i, '')
    .replace(/\s+position$/i, '')
    .replace(/\s+role$/i, '')
    .replace(/[.!]+$/g, '')
    .trim()
}
