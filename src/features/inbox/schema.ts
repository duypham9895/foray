import { z } from 'zod'

export const parsedEmailSchema = z.object({
  gmailMessageId: z.string().min(1),
  gmailThreadId: z.string().min(1),
  from: z.string(),
  fromDomain: z.string(),
  subject: z.string(),
  bodyExcerpt: z.string().max(500),
  receivedAt: z.date(),
})

export type ParsedEmailInput = z.infer<typeof parsedEmailSchema>

export const overrideClassificationSchema = z.object({
  emailId: z.number().int().positive(),
  newClassification: z.enum([
    'rejection',
    'interview_invite',
    'recruiter_outreach',
    'noise',
    'unmatched',
  ]),
})

export const linkApplicationSchema = z.object({
  emailId: z.number().int().positive(),
  applicationId: z.number().int().positive(),
})

export const reviewActionSchema = z.object({
  emailId: z.number().int().positive(),
})
