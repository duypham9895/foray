// Zod schemas for the documents slice.
//
// uploadSchema validates form input; ALLOWED_MIME_TYPES and MAX_FILE_SIZE
// are the server-side file validation constants. MIME detection uses magic
// bytes (first 4-8 bytes), NOT file extension — see service.ts detectMimeType.

import { z } from 'zod'

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export const documentKindEnum = z.enum([
  'resume',
  'cover_letter',
  'jd_pdf',
  'take_home',
  'other',
])

export type DocumentKind = z.infer<typeof documentKindEnum>

// Magic-byte MIME allowlist. Checked against first 4-8 bytes of file, NOT extension.
// Empty magic array (text/plain) is checked last as a fallback.
export const ALLOWED_MIME_TYPES: Record<
  string,
  { ext: string; magic: number[] }
> = {
  'application/pdf': {
    ext: 'pdf',
    magic: [0x25, 0x50, 0x44, 0x46],
  },
  'application/msword': {
    ext: 'doc',
    magic: [0xd0, 0xcf, 0x11, 0xe0],
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    ext: 'docx',
    magic: [0x50, 0x4b, 0x03, 0x04],
  },
  'text/plain': {
    ext: 'txt',
    magic: [], // fallback: checked last
  },
  'image/png': {
    ext: 'png',
    magic: [0x89, 0x50, 0x4e, 0x47],
  },
  'image/jpeg': {
    ext: 'jpg',
    magic: [0xff, 0xd8, 0xff],
  },
}

export const uploadSchema = z.object({
  kind: documentKindEnum,
  notes: z
    .string()
    .max(2000)
    .optional()
    .or(z.literal('')),
})
