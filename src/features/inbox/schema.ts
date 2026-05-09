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
