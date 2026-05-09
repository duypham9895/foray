// Branded ID types — compile-time tenant safety.
//
// Without branding, ApplicationId and UserId are both `string` and the compiler
// will happily let you swap them. With branding it won't — preventing the
// userId/tenantId mixup that's the #1 multi-tenant bug.
//
// See PRINCIPLES.md §"Branded types for IDs" for usage rules.

declare const brand: unique symbol
export type Brand<T, B> = T & { readonly [brand]: B }

export type UserId        = Brand<string, 'UserId'>
export type ApplicationId = Brand<string, 'ApplicationId'>
export type CompanyId     = Brand<string, 'CompanyId'>
export type StageId       = Brand<string, 'StageId'>
export type EventId       = Brand<string, 'EventId'>
export type EmailId       = Brand<string, 'EmailId'>
export type RecruiterId   = Brand<string, 'RecruiterId'>
export type DocumentId    = Brand<string, 'DocumentId'>

const numericIdRegex = /^\d+$/

function makeId<B extends string>(brandName: B) {
  return (input: string | number): Brand<string, B> => {
    const str = String(input)
    if (!numericIdRegex.test(str)) {
      throw new Error(`Invalid ${brandName}: ${JSON.stringify(input)}`)
    }
    return str as Brand<string, B>
  }
}

export const UserId        = makeId('UserId')
export const ApplicationId = makeId('ApplicationId')
export const CompanyId     = makeId('CompanyId')
export const StageId       = makeId('StageId')
export const EventId       = makeId('EventId')
export const EmailId       = makeId('EmailId')
export const RecruiterId   = makeId('RecruiterId')
export const DocumentId    = makeId('DocumentId')
