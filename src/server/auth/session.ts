import { createHash } from 'crypto'
import { SignJWT, jwtVerify } from 'jose'
import { SESSION_COOKIE } from './constants'

export { SESSION_COOKIE }
const SESSION_TTL_SECONDS = 12 * 60 * 60

function envOr(name: string, fallback: string): string {
  const value = process.env[name]
  return value && value.length > 0 ? value : fallback
}

export function authCredentials() {
  return {
    username: envOr('DASHBOARD_USER', 'adminTel'),
    password: envOr('DASHBOARD_PASS', 'Trup3r*2027.!'),
  }
}

function sessionSecret(): Uint8Array {
  const raw = envOr('SESSION_SECRET', `${authCredentials().username}:${authCredentials().password}:noc-cve`)
  return new TextEncoder().encode(raw)
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: 'dashboard' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(sessionSecret())
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false
  try {
    await jwtVerify(token, sessionSecret())
    return true
  } catch {
    return false
  }
}

export function credentialsMatch(username: string, password: string): boolean {
  const expected = authCredentials()
  return username === expected.username && password === expected.password
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  }
}

export function authConfigFingerprint(): string {
  const { username } = authCredentials()
  return createHash('sha256').update(username).digest('hex').slice(0, 8)
}
