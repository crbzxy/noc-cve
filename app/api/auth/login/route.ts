import { NextResponse } from 'next/server'
import {
  credentialsMatch,
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
} from '@/server/auth/session'

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') ?? ''
  let username = ''
  let password = ''

  let nextFromBody = '/'
  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => ({})) as {
      username?: string
      password?: string
      next?: string
    }
    username = String(body.username ?? '')
    password = String(body.password ?? '')
    nextFromBody = String(body.next ?? '/')
  } else {
    const form = await request.formData()
    username = String(form.get('username') ?? '')
    password = String(form.get('password') ?? '')
    nextFromBody = String(form.get('next') ?? '/')
  }

  if (!credentialsMatch(username, password)) {
    return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 })
  }

  const token = await createSessionToken()
  const secure = request.headers.get('x-forwarded-proto') === 'https'
    || new URL(request.url).protocol === 'https:'
  const nextUrl = new URL(request.url).searchParams.get('next') || nextFromBody || '/'
  const safeNext = nextUrl.startsWith('/') && !nextUrl.startsWith('//') ? nextUrl : '/'

  const wantsJson = (request.headers.get('accept') ?? '').includes('application/json')
  const response = wantsJson
    ? NextResponse.json({ ok: true, next: safeNext })
    : NextResponse.redirect(new URL(safeNext, request.url), 302)

  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(secure))
  return response
}
