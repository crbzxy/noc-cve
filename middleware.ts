import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { SESSION_COOKIE } from './src/server/auth/constants'

function sessionSecret(): Uint8Array {
  const username = process.env.DASHBOARD_USER || 'adminTel'
  const password = process.env.DASHBOARD_PASS || 'Trup3r*2027.!'
  const raw = process.env.SESSION_SECRET || `${username}:${password}:noc-cve`
  return new TextEncoder().encode(raw)
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) return false
  try {
    await jwtVerify(token, sessionSecret())
    return true
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isLogin = pathname === '/login'
  const isAuthApi = pathname.startsWith('/api/auth/')
  const isPublicAsset = pathname.startsWith('/_next')
    || pathname.startsWith('/config/')
    || pathname === '/favicon.ico'

  if (isPublicAsset || isAuthApi) return NextResponse.next()

  const authed = await hasValidSession(request)

  if (isLogin) {
    if (authed) return NextResponse.redirect(new URL('/', request.url))
    return NextResponse.next()
  }

  if (!authed) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const login = new URL('/login', request.url)
    login.searchParams.set('next', pathname)
    return NextResponse.redirect(login)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
