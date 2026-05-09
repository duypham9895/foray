// ATS-domain blocklist — shared between the capture form (CAPT-02 server- and
// client-side validation) and Phase 3 matcher (MATCH-02 sender-domain skip).
//
// We block these as Company.domain values because they are platform domains,
// not the company's actual domain. Pulling from this list in two places means
// one source of truth for "what counts as an ATS".

export const ATS_DOMAINS = [
  'greenhouse.io',
  'lever.co',
  'workday.com',
  'myworkdayjobs.com',
  'linkedin.com',
  'ashbyhq.com',
  'smartrecruiters.com',
  'jobvite.com',
  'icims.com',
  'taleo.net',
  'recruitee.com',
  'breezy.hr',
  'bamboohr.com',
  'indeed.com',
  'glassdoor.com',
] as const

export type AtsDomain = (typeof ATS_DOMAINS)[number]

/**
 * Returns true if `input` resolves to one of ATS_DOMAINS.
 * - Lowercases + trims input
 * - Strips protocol (https://, http://) and any path/query/fragment
 * - Matches if the resulting host equals an ATS apex OR ends with `.{apex}`
 */
export function isAtsDomain(input: string): boolean {
  const trimmed = input.trim().toLowerCase()
  if (trimmed === '') return false
  // Strip protocol
  const noProtocol = trimmed.replace(/^https?:\/\//, '')
  // Take only the host portion (before first /, ?, #)
  const host = noProtocol.split(/[/?#]/, 1)[0]
  if (!host) return false
  return ATS_DOMAINS.some(
    (apex) => host === apex || host.endsWith(`.${apex}`),
  )
}
