import 'server-only'
import type { SessionOptions } from 'iron-session'

import { env } from '@/core/env'
import type { UserId } from '@/core/types/ids'

export type SessionData = {
  userId: UserId
  issuedAt: number // ms epoch
}

export const sessionOptions: SessionOptions = {
  password: env.APP_SESSION_SECRET, // ≥32 chars, validated by env.ts
  cookieName: 'foray_session',
  cookieOptions: {
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax', // 'lax' lets future bookmarklet POST work; 'strict' would break it
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
}
