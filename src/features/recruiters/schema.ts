import { z } from 'zod'

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value

export const recruiterInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(160),
  email: z.preprocess(
    emptyToUndefined,
    z.string().trim().email('Use a valid email').max(254).optional(),
  ),
  linkedinUrl: z.preprocess(
    emptyToUndefined,
    z.string().trim().url('Use a valid URL').max(2048).optional(),
  ),
  phone: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(80).optional(),
  ),
  notes: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(4000).optional(),
  ),
  companyId: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().optional(),
  ),
})

export const linkRecruiterInputSchema = z.object({
  recruiterId: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().optional(),
  ),
  role: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(80).optional(),
  ),
  name: z.preprocess(
    emptyToUndefined,
    z.string().trim().min(1, 'Name is required when creating a recruiter').max(160).optional(),
  ),
  email: z.preprocess(
    emptyToUndefined,
    z.string().trim().email('Use a valid email').max(254).optional(),
  ),
  linkedinUrl: z.preprocess(
    emptyToUndefined,
    z.string().trim().url('Use a valid URL').max(2048).optional(),
  ),
  phone: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(80).optional(),
  ),
  notes: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(4000).optional(),
  ),
})

export type RecruiterInput = z.infer<typeof recruiterInputSchema>
export type LinkRecruiterInput = z.infer<typeof linkRecruiterInputSchema>
