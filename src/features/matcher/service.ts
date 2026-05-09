// Matcher slice — read-only DB function that maps an incoming email to an
// Application via the LOCKED 4-step tiebreak from CONTEXT §Area 5.
//
//   1. Thread continuity — most-recent Email on the same gmailThreadId that
//      is already linked to an Application wins.
//   2. ATS-domain skip — BEFORE step 3, short-circuit when fromDomain is an
//      ATS infrastructure domain (Pitfall #5: Greenhouse/Lever/etc emails
//      must NEVER false-attribute to a stored Company).
//   3. Sender-domain match — Company.domain == fromDomain → most-recent
//      application for that company.
//   4. Unmatched — return ok({ applicationId: null }). "Unmatched" is a
//      normal outcome (the email goes to the review queue in Phase 4),
//      NOT an error.
//
// Phase 4 contract: matchEmail does NOT mutate email.applicationId. The
// act-stage in Phase 4 owns the write after both match + classify succeed.
//
// All Prisma access via withRls(userId), per the established
// applications/queries.ts pattern. The runtime DATABASE_URL points to
// foray_app (non-superuser, FORCE RLS active) — without the GUC set,
// RLS denies all rows. tenantDb's auto-userId-injection is unnecessary
// here because RLS already filters by the GUC inside the transaction.
// See deviation note in 03-03-SUMMARY.md (Rule 1).

import 'server-only'

import { withRls } from '@/core/db/with-rls'
import { isAtsDomain } from '@/core/domains/ats-domains'
import { errors, err, type AppError } from '@/core/errors'
import { ApplicationId, type UserId } from '@/core/types/ids'
import type { Result } from 'neverthrow'

import {
  matchEmailInputSchema,
  type MatchEmailInput,
  type MatchEmailOutput,
} from './schema'

/**
 * Map an incoming email to an existing Application via the 4-step tiebreak.
 *
 * Read-only; does not write email.applicationId (Phase 4's act-stage owns
 * that write after match + classify both succeed).
 *
 * @param rawInput - { userId (already branded), gmailThreadId, fromDomain }
 * @returns ok({ applicationId }) where applicationId is the matched
 *          ApplicationId or null when no match (unmatched is a normal
 *          outcome, NOT an error). err on Validation or Db.
 */
export async function matchEmail(
  rawInput: MatchEmailInput,
): Promise<Result<MatchEmailOutput, AppError>> {
  const parsed = matchEmailInputSchema.safeParse(rawInput)
  if (!parsed.success) return err(errors.validation(parsed.error.issues))

  // userId arrives already-branded from the caller; the schema validates the
  // string shape. Restore the brand at the type-system boundary — see
  // threat T-03-03-04 for the runtime trust contract.
  const { userId, gmailThreadId, fromDomain } = parsed.data
  const brandedUserId = userId as UserId

  return withRls(brandedUserId, async (tx): Promise<MatchEmailOutput> => {
    // 1. Thread continuity — most-recent linked email on this thread wins.
    const threadEmail = await tx.email.findFirst({
      where: { gmailThreadId, applicationId: { not: null } },
      orderBy: { receivedAt: 'desc' },
      select: { applicationId: true },
    })
    if (threadEmail?.applicationId) {
      return { applicationId: ApplicationId(threadEmail.applicationId) }
    }

    // 2. ATS-domain skip — BEFORE domain match (Pitfall #5).
    // Defense-in-depth: even if Phase 2's capture validation gets bypassed
    // and an ATS domain ends up in Company.domain, the matcher refuses to
    // attribute ATS-shaped emails to that company.
    if (isAtsDomain(fromDomain)) {
      return { applicationId: null }
    }

    // 3. Sender-domain match — most-recent application for the matched company.
    const company = await tx.company.findFirst({
      where: { domain: fromDomain },
      include: {
        applications: {
          orderBy: { appliedAt: 'desc' },
          take: 1,
          select: { id: true },
        },
      },
    })
    if (company && company.applications.length > 0) {
      const firstApp = company.applications[0]
      if (firstApp) {
        return { applicationId: ApplicationId(firstApp.id) }
      }
    }

    // 4. Unmatched — normal outcome, not an error.
    return { applicationId: null }
  })
}
