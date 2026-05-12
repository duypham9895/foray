function firstHeaderValue(value: string | null): string | null {
  return value?.split(',')[0]?.trim() || null
}

export function getPublicOrigin(request: Request): string {
  const forwardedProto = firstHeaderValue(request.headers.get('x-forwarded-proto'))
  const forwardedHost = firstHeaderValue(request.headers.get('x-forwarded-host'))

  if (forwardedProto && forwardedHost) {
    try {
      return new URL(`${forwardedProto}://${forwardedHost}`).origin
    } catch {
      // Fall back to the request URL below if a proxy sends malformed headers.
    }
  }

  return new URL(request.url).origin
}
