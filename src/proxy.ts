import { NextRequest, NextResponse } from 'next/server'

export function proxy(req: NextRequest) {
  const session = req.cookies.get('foray_session')
  if (!session && !req.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return NextResponse.next()
}

export const config = {
  // Keep auth proxy off API routes; route handlers perform their own
  // boundary checks and cross-origin endpoints need JSON responses.
  matcher: ['/((?!api|login|_next|favicon.ico).*)'],
}
