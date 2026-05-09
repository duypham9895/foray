// Matcher slice — input/output schemas for matchEmail.
//
// matchEmail is a read-only DB function that maps an incoming email to an
// existing Application via the LOCKED 4-step tiebreak (CONTEXT §Area 5):
//
//   1. thread continuity   — gmailThreadId already linked to an Application
//   2. ATS-domain skip     — fromDomain matches an ATS infrastructure domain
//   3. sender-domain match — Company.domain == fromDomain
//   4. unmatched           — return null
//
// Contract notes:
// - userId arrives ALREADY BRANDED from the caller (Phase 4). We validate it
//   as a non-empty string here; the brand is preserved at the type-system
//   boundary inside service.ts.
// - fromDomain is the lowercased apex+TLD. The CALLER (Phase 4) is
//   responsible for parsing the From header and producing this value. The
//   service does NOT lowercase, strip protocol, or otherwise normalize.
// - gmailThreadId is the Gmail thread identifier (string).

import { z } from 'zod'

import type { ApplicationId } from '@/core/types/ids'

export const matchEmailInputSchema = z.object({
  userId: z.string().min(1, 'userId required'),
  gmailThreadId: z.string().min(1, 'gmailThreadId required'),
  fromDomain: z.string().min(1, 'fromDomain required'),
})

export type MatchEmailInput = z.infer<typeof matchEmailInputSchema>

export type MatchEmailOutput = {
  applicationId: ApplicationId | null
}
