// One-time maintenance script:
// Reclassify previously-ingested rules/unmatched emails through the selected
// LLM provider, then route the result through the same match/act gates used by
// Gmail sync. Run with:
//
//   pnpm tsx scripts/reclassify-unmatched-emails.ts

import 'dotenv/config'

import crypto from 'node:crypto'

import Anthropic from '@anthropic-ai/sdk'
import type { Tool } from '@anthropic-ai/sdk/resources/messages/messages.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { Prisma, PrismaClient } from '../src/generated/prisma/client'
import type {
  CanonicalStatus,
  EmailClassification,
  LlmProvider,
} from '../src/generated/prisma/client'

import { isStatusRegression } from '../src/features/applications/status-transitions'
import { classifyByRules } from '../src/features/classifier/rules'
import {
  CLASSIFY_OUTPUT_JSON_SCHEMA,
  SYSTEM_PROMPT,
  classifyEmailInputSchema,
  classifyToolOutputSchema,
} from '../src/features/classifier/schema'
import { meetsThreshold } from '../src/features/classifier/thresholds'
import { isAtsDomain } from '../src/core/domains/ats-domains'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const USER_ID = Number(process.env.RECLASSIFY_USER_ID ?? 1)
const LIMIT = Number(process.env.RECLASSIFY_LIMIT ?? 200)
const RULES_SHORT_CIRCUIT = 0.85
const DAILY_BUDGET_USD = 0.5
const OPENAI_MODEL = 'gpt-5.4-nano'
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'
const MAX_OUTPUT_TOKENS = 256
const TIMEOUT_MS = 15_000

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const db = new PrismaClient({ adapter })

type TargetEmail = {
  id: number
  gmailMessageId: string
  gmailThreadId: string
  from: string
  fromDomain: string
  subject: string
  bodyExcerpt: string
  receivedAt: Date
  reviewedByUser: boolean
}

type Classification = {
  label: EmailClassification
  confidence: number
  classifiedBy: 'rules' | 'llm'
  inputTokens?: number
  outputTokens?: number
}

type RouteAction = 'auto_updated' | 'needs_review' | 'skipped'

async function withUser<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${String(USER_ID)}, true)`
    return fn(tx)
  })
}

async function main() {
  const provider = await getSelectedProvider()
  const emails = await getTargets()

  console.log(`Selected provider: ${provider}`)
  console.log(`Found ${emails.length} rules/unmatched emails to reclassify`)

  const stats = {
    inspected: emails.length,
    reclassified: 0,
    autoUpdated: 0,
    needsReview: 0,
    skipped: 0,
    failed: 0,
  }

  for (const email of emails) {
    try {
      const classification = await classifyExistingEmail(email, provider)
      const action = await routeEmail(email, classification)

      stats.reclassified += 1
      if (action === 'auto_updated') stats.autoUpdated += 1
      if (action === 'needs_review') stats.needsReview += 1
      if (action === 'skipped') stats.skipped += 1

      console.log(
        `email ${email.id}: ${classification.classifiedBy}/${classification.label}/${classification.confidence.toFixed(2)} -> ${action}`,
      )
    } catch (cause) {
      stats.failed += 1
      console.error(`email ${email.id}: failed: ${formatCause(cause)}`)
      if (cause instanceof Error && cause.message.startsWith('budget_exhausted')) {
        break
      }
    }
  }

  console.log(JSON.stringify(stats, null, 2))
}

async function getSelectedProvider(): Promise<LlmProvider> {
  return withUser(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: USER_ID },
      select: { classifierLlmProvider: true },
    })
    if (!user) throw new Error(`user ${USER_ID} not found`)
    return user.classifierLlmProvider
  })
}

async function getTargets(): Promise<TargetEmail[]> {
  return withUser(async (tx) => {
    return tx.email.findMany({
      where: {
        userId: USER_ID,
        classifiedBy: 'rules',
        classification: 'unmatched',
        reviewedByUser: false,
      },
      orderBy: { receivedAt: 'desc' },
      take: LIMIT,
      select: {
        id: true,
        gmailMessageId: true,
        gmailThreadId: true,
        from: true,
        fromDomain: true,
        subject: true,
        bodyExcerpt: true,
        receivedAt: true,
        reviewedByUser: true,
      },
    })
  })
}

async function classifyExistingEmail(
  email: TargetEmail,
  provider: LlmProvider,
): Promise<Classification> {
  const parsed = classifyEmailInputSchema.safeParse({
    subject: email.subject,
    bodyExcerpt: email.bodyExcerpt,
  })
  if (!parsed.success) {
    throw new Error('validation_failed')
  }

  const rules = classifyByRules(parsed.data)
  if (rules.confidence >= RULES_SHORT_CIRCUIT) {
    return {
      label: rules.label,
      confidence: rules.confidence,
      classifiedBy: 'rules',
    }
  }

  await checkBudget()
  const llm =
    provider === 'openai'
      ? await classifyByOpenAi(parsed.data)
      : await classifyByAnthropic(parsed.data)

  await appendCostEntry({
    model: provider === 'openai' ? OPENAI_MODEL : ANTHROPIC_MODEL,
    inputTokens: llm.inputTokens ?? 0,
    outputTokens: llm.outputTokens ?? 0,
    emailHash: hashEmailContent(email.subject, email.bodyExcerpt),
  })

  return llm
}

async function routeEmail(
  email: TargetEmail,
  classification: Classification,
): Promise<RouteAction> {
  return withUser(async (tx) => {
    if (email.reviewedByUser) return 'skipped'

    const applicationId = await matchApplicationId(tx, email)
    const emailCount = await tx.email.count({ where: { userId: USER_ID } })
    const newStatus = labelToStatus(classification.label)
    const canAutoUpdate =
      emailCount >= 50 &&
      applicationId !== null &&
      newStatus !== null &&
      meetsThreshold(classification.label, classification.confidence)

    if (canAutoUpdate && applicationId && newStatus) {
      const app = await tx.application.findUnique({
        where: { id: applicationId },
        select: { canonicalStatus: true },
      })

      if (app && !isStatusRegression(app.canonicalStatus, newStatus)) {
        if (app.canonicalStatus !== newStatus) {
          await tx.application.update({
            where: { id: applicationId },
            data: { canonicalStatus: newStatus, lastActivityAt: new Date() },
          })
          await tx.event.create({
            data: {
              userId: USER_ID,
              applicationId,
              type: 'auto_status_changed',
              source: 'cron',
              undoable: true,
              data: {
                previousStatus: app.canonicalStatus,
                newStatus,
                emailId: email.id,
                classifierConfidence: classification.confidence,
                classifiedBy: classification.classifiedBy,
              },
            },
          })
        }

        await tx.email.update({
          where: { id: email.id },
          data: {
            classification: classification.label,
            confidence: classification.confidence,
            classifiedBy: classification.classifiedBy,
            applicationId,
            processingStatus: 'acted',
          },
        })
        return 'auto_updated'
      }
    }

    await tx.email.update({
      where: { id: email.id },
      data: {
        classification: classification.label,
        confidence: classification.confidence,
        classifiedBy: classification.classifiedBy,
        applicationId,
        processingStatus: 'needs_review',
      },
    })
    return 'needs_review'
  })
}

async function matchApplicationId(
  tx: Prisma.TransactionClient,
  email: TargetEmail,
): Promise<number | null> {
  const threadEmail = await tx.email.findFirst({
    where: { gmailThreadId: email.gmailThreadId, applicationId: { not: null } },
    orderBy: { receivedAt: 'desc' },
    select: { applicationId: true },
  })
  if (threadEmail?.applicationId) return threadEmail.applicationId

  if (isAtsDomain(email.fromDomain)) return null

  const company = await tx.company.findFirst({
    where: { domain: email.fromDomain },
    include: {
      applications: {
        orderBy: { appliedAt: 'desc' },
        take: 1,
        select: { id: true },
      },
    },
  })
  return company?.applications[0]?.id ?? null
}

function labelToStatus(label: EmailClassification): CanonicalStatus | null {
  switch (label) {
    case 'rejection':
      return 'rejected'
    case 'interview_invite':
      return 'interviewing'
    case 'recruiter_outreach':
    case 'noise':
    case 'unmatched':
      return null
  }
}

type LlmInput = {
  subject: string
  bodyExcerpt: string
}

async function classifyByOpenAi(input: LlmInput): Promise<Classification> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY_missing')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const userMessage = `Subject: ${input.subject}\n\nBody (excerpt, <=500 chars): ${input.bodyExcerpt}`

  let response: Response
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        instructions: SYSTEM_PROMPT,
        input: [{ role: 'user', content: userMessage }],
        max_output_tokens: MAX_OUTPUT_TOKENS,
        text: {
          format: {
            type: 'json_schema',
            name: 'classify_email',
            strict: true,
            schema: CLASSIFY_OUTPUT_JSON_SCHEMA,
          },
        },
      }),
    })
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    throw new Error(`openai_http_${response.status}`)
  }

  const body = await response.json() as {
    output_text?: string
    output?: Array<{
      type?: string
      content?: Array<{ type?: string; text?: string }>
    }>
    usage?: { input_tokens?: number; output_tokens?: number }
  }
  const outputText = extractOpenAiOutputText(body)
  if (!outputText) throw new Error('openai_unstructured_response')

  const parsed = classifyToolOutputSchema.safeParse(JSON.parse(outputText))
  if (!parsed.success) throw new Error('openai_invalid_tool_output')

  return {
    label: parsed.data.label,
    confidence: parsed.data.confidence,
    classifiedBy: 'llm',
    inputTokens: body.usage?.input_tokens ?? 0,
    outputTokens: body.usage?.output_tokens ?? 0,
  }
}

async function classifyByAnthropic(input: LlmInput): Promise<Classification> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY_missing')

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: TIMEOUT_MS,
    maxRetries: 0,
  })
  const tool: Tool = {
    name: 'classify_email',
    description: 'Classify a job-related email into one of 5 labels.',
    input_schema: CLASSIFY_OUTPUT_JSON_SCHEMA as Tool['input_schema'],
  }
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [tool],
    tool_choice: { type: 'tool', name: 'classify_email' },
    messages: [
      {
        role: 'user',
        content: `Subject: ${input.subject}\n\nBody (excerpt, <=500 chars): ${input.bodyExcerpt}`,
      },
    ],
  })

  const toolUse = response.content.find(
    (block) => block.type === 'tool_use' && block.name === 'classify_email',
  )
  if (!toolUse) throw new Error('anthropic_unstructured_response')

  const parsed = classifyToolOutputSchema.safeParse((toolUse as { input: unknown }).input)
  if (!parsed.success) throw new Error('anthropic_invalid_tool_output')

  return {
    label: parsed.data.label,
    confidence: parsed.data.confidence,
    classifiedBy: 'llm',
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}

function extractOpenAiOutputText(body: {
  output_text?: string
  output?: Array<{
    type?: string
    content?: Array<{ type?: string; text?: string }>
  }>
}): string | null {
  if (typeof body.output_text === 'string') return body.output_text

  for (const item of body.output ?? []) {
    if (item.type !== 'message') continue
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        return content.text
      }
    }
  }

  return null
}

type CostLogEntry = {
  ts: string
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  emailHash: string
}

async function checkBudget(): Promise<void> {
  const { promises: fs } = await import('node:fs')
  const filePath = process.env.CLASSIFIER_LOG_PATH ?? 'data/classifier-log.jsonl'

  let raw: string
  try {
    raw = await fs.readFile(filePath, 'utf8')
  } catch (cause) {
    if (isFileNotFoundError(cause)) return
    throw new Error('budget_unreadable')
  }

  const today = new Date().toISOString().slice(0, 10)
  let total = 0
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const entry = JSON.parse(trimmed) as CostLogEntry
    if (entry.ts.slice(0, 10) === today) {
      total += entry.costUsd
    }
  }

  if (total >= DAILY_BUDGET_USD) {
    throw new Error(`budget_exhausted_${total.toFixed(6)}`)
  }
}

async function appendCostEntry(input: {
  model: string
  inputTokens: number
  outputTokens: number
  emailHash: string
}): Promise<void> {
  const { promises: fs } = await import('node:fs')
  const path = await import('node:path')
  const filePath = process.env.CLASSIFIER_LOG_PATH ?? 'data/classifier-log.jsonl'
  const entry: CostLogEntry = {
    ts: new Date().toISOString(),
    model: input.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    costUsd: computeCostUsd(input.inputTokens, input.outputTokens, input.model),
    emailHash: input.emailHash,
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.appendFile(filePath, JSON.stringify(entry) + '\n', 'utf8')
}

function computeCostUsd(inputTokens: number, outputTokens: number, model: string): number {
  if (model === OPENAI_MODEL) {
    return (inputTokens / 1_000_000) * 0.2 + (outputTokens / 1_000_000) * 1.25
  }
  return (inputTokens / 1_000_000) * 0.8 + (outputTokens / 1_000_000) * 4.0
}

function hashEmailContent(subject: string, bodyExcerpt: string): string {
  const digest = crypto.createHash('sha256').update(subject + '\n' + bodyExcerpt).digest('hex')
  return 'sha256:' + digest
}

function isFileNotFoundError(cause: unknown): boolean {
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    (cause as { code?: string }).code === 'ENOENT'
  )
}

function formatCause(cause: unknown): string {
  if (cause instanceof Error) return cause.message
  return String(cause)
}

main()
  .catch((cause) => {
    console.error(formatCause(cause))
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })
