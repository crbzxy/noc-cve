import { NextResponse } from 'next/server'
import { SESSION_COOKIE, sessionCookieOptions } from '@/server/auth/session'

function clearSession(request: Request) {
  const secure = request.headers.get('x-forwarded-proto') === 'https'
    || new URL(request.url).protocol === 'https:'
  const response = NextResponse.redirect(new URL('/login', request.url), 302)
  response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(secure), maxAge: 0 })
  return response
}

export async function GET(request: Request) {
  return clearSession(request)
}

export async function POST(request: Request) {
  return clearSession(request)
}
