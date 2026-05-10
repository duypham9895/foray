// Zod schemas for the applications slice.
//
// Single source of truth for all input validation in Phase 2 (capture form,
// stage edits, notes edits, status dropdown) and the Phase 4 service contract
// (Event.data shape per EventType). Server is canonical via safeParse in
// actions; the client form imports the same schemas for inline hints.
//
// CAPT-02 (ATS-domain rejection) is enforced here via .superRefine() on
// companyInputSchema and createApplicationSchema, importing the shared
// blocklist from @/core/domains/ats-domains.

import { z } from 'zod'
import { isAtsDomain } from '@/core/domains/ats-domains'

// Reusable enum atoms — values mirror the Prisma enums exactly. ----------

export const canonicalStatusEnum = z.enum([
  'applied',
  'screening',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
])
export const applicationSourceEnum = z.enum([
  'linkedin',
  'direct',
  'referral',
  'recruiter',
  'other',
])
export const stageOutcomeEnum = z.enum(['passed', 'failed', 'no_response'])
export const eventSourceEnum = z.enum([
  'manual',
  'gmail',
  'bookmarklet',
  'extension',
  'cron',
  'system',
])
export const classifiedByEnum = z.enum(['rules', 'llm', 'manual'])

// ATS rejection helpers — DRY one error message + one .superRefine body.
// Inlined into both companyInputSchema and createApplicationSchema since
// each schema owns its own field path.
const atsRejectionMessage = (domain: string) =>
  `That looks like an ATS domain (${domain}). Use the company's actual domain (e.g., stripe.com) — ATS platforms aren't the company you're applying to.`

const atsUrlRejectionMessage = (url: string) =>
  `That looks like an ATS URL (${url}). Visit the ATS directly and log the application — ATS links aren't the company's careers page.`

// Company input ----------------------------------------------------------

export const companyInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Company name is required').max(120),
    domain: z.string().trim().max(253).optional().or(z.literal('')),
  })
  .superRefine((val, ctx) => {
    if (val.domain && val.domain !== '' && isAtsDomain(val.domain)) {
      ctx.addIssue({
        code: 'custom',
        path: ['domain'],
        message: atsRejectionMessage(val.domain.trim()),
      })
    }
  })

export type CompanyInput = z.infer<typeof companyInputSchema>

// Application create -----------------------------------------------------

export const createApplicationSchema = z
  .object({
    companyName: z.string().trim().min(1, 'Company is required').max(120),
    companyDomain: z.string().trim().max(253).optional().or(z.literal('')),
    roleTitle: z.string().trim().min(1, 'Role title is required').max(160),
    roleUrl: z
      .string()
      .trim()
      .url('Must be a valid URL')
      .max(2048)
      .optional()
      .or(z.literal('')),
    jobDescription: z.string().max(50_000).optional().or(z.literal('')),
    location: z.string().trim().max(120).optional().or(z.literal('')),
    salaryMin: z.coerce.number().int().nonnegative().optional(),
    salaryMax: z.coerce.number().int().nonnegative().optional(),
    salaryCurrency: z.string().trim().max(8).optional().or(z.literal('')),
    source: applicationSourceEnum.default('other'),
    appliedAt: z.coerce.date().default(() => new Date()),
    notes: z.string().max(2000).optional().or(z.literal('')),
  })
  .superRefine((val, ctx) => {
    if (val.companyDomain && val.companyDomain !== '' && isAtsDomain(val.companyDomain)) {
      ctx.addIssue({
        code: 'custom',
        path: ['companyDomain'],
        message: atsRejectionMessage(val.companyDomain),
      })
    }
    if (val.roleUrl && val.roleUrl !== '' && isAtsDomain(val.roleUrl)) {
      ctx.addIssue({
        code: 'custom',
        path: ['roleUrl'],
        message: atsUrlRejectionMessage(val.roleUrl),
      })
    }
    if (
      val.salaryMin !== undefined &&
      val.salaryMax !== undefined &&
      val.salaryMin > val.salaryMax
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['salaryMax'],
        message: 'salary range invalid: min greater than max',
      })
    }
  })

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>

// Application status update (manual dropdown) ----------------------------

export const updateApplicationStatusSchema = z.object({
  applicationId: z.coerce.number().int().positive(),
  newStatus: canonicalStatusEnum,
})
export type UpdateApplicationStatusInput = z.infer<typeof updateApplicationStatusSchema>

// Stage ------------------------------------------------------------------

export const stageInputSchema = z.object({
  name: z.string().trim().min(1, 'Stage name is required').max(120),
  scheduledAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  outcome: stageOutcomeEnum.optional(),
  notes: z.string().max(2000).optional().or(z.literal('')),
})
export type StageInput = z.infer<typeof stageInputSchema>

// Notes (application-level) ---------------------------------------------

export const notesInputSchema = z.object({
  notes: z.string().max(10_000),
})
export type NotesInput = z.infer<typeof notesInputSchema>

// Follow-up date input -------------------------------------------------

export const followUpInputSchema = z.object({
  followUpAt: z.coerce.date(),
})
export type FollowUpInput = z.infer<typeof followUpInputSchema>

// Event.data per EventType (Phase 4 hard contract) ----------------------
//
// emailId is part of the strict() shape so callers MUST include it before
// .parse() — do NOT spread emailId after parse, that would bypass strict().

const createdData = z.strictObject({ source: eventSourceEnum })
const statusChangedData = z.strictObject({
  previousStatus: canonicalStatusEnum,
  newStatus: canonicalStatusEnum,
})
const autoStatusChangedData = z.strictObject({
  previousStatus: canonicalStatusEnum,
  newStatus: canonicalStatusEnum,
  classifierConfidence: z.number().min(0).max(1).optional(),
  classifiedBy: classifiedByEnum.optional(),
  emailId: z.coerce.number().int().positive().optional(),
})
const statusUndoneData = z.strictObject({
  undoneEventId: z.coerce.number().int().positive(),
  restoredStatus: canonicalStatusEnum,
})
const stageAddedData = z.strictObject({
  stageId: z.coerce.number().int().positive(),
  stageName: z.string().min(1).max(120),
})
const stageCompletedData = z.strictObject({
  stageId: z.coerce.number().int().positive(),
  outcome: stageOutcomeEnum,
})
const emailReceivedData = z.strictObject({
  emailId: z.coerce.number().int().positive(),
})
const noteAddedData = z.strictObject({})
// Generic loose-passthrough fallback for events that don't carry typed data
// in Phase 2 — timeline rendering can fall back to "Event #{id}" gracefully.
const genericPassthrough = z.looseObject({})

export const eventDataSchemas = {
  created: createdData,
  status_changed: statusChangedData,
  auto_status_changed: autoStatusChangedData,
  status_undone: statusUndoneData,
  stage_added: stageAddedData,
  stage_completed: stageCompletedData,
  email_received: emailReceivedData,
  note_added: noteAddedData,
  manual_classification: genericPassthrough,
  document_uploaded: genericPassthrough,
  recruiter_linked: genericPassthrough,
  archived: genericPassthrough,
  unarchived: genericPassthrough,
} as const

export function eventDataSchemaFor(type: string): z.ZodType {
  return (eventDataSchemas as Record<string, z.ZodType>)[type] ?? genericPassthrough
}
