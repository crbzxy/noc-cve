import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

const COOKIE_NAME = 'noc_cve_session'
const SESSION_TTL_MS = 12 * 60 * 60 * 1000
const sessions = new Map()

function envOr(name, fallback) {
  const value = process.env[name]
  return value && value.length > 0 ? value : fallback
}

/** Credenciales de acceso al dashboard (sobreescribibles por env). */
export function authCredentials() {
  return {
    username: envOr('DASHBOARD_USER', 'adminTel'),
    password: envOr('DASHBOARD_PASS', 'Trup3r*2027.!'),
  }
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left))
  const b = Buffer.from(String(right))
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function credentialsMatch(username, password) {
  const expected = authCredentials()
  return safeEqual(username, expected.username) && safeEqual(password, expected.password)
}

function pruneSessions(now = Date.now()) {
  for (const [token, expiresAt] of sessions) {
    if (expiresAt <= now) sessions.delete(token)
  }
}

function createSession() {
  pruneSessions()
  const token = randomBytes(32).toString('hex')
  sessions.set(token, Date.now() + SESSION_TTL_MS)
  return token
}

function sessionValid(token) {
  if (!token) return false
  pruneSessions()
  const expiresAt = sessions.get(token)
  if (!expiresAt) return false
  if (expiresAt <= Date.now()) {
    sessions.delete(token)
    return false
  }
  return true
}

function parseCookies(header) {
  const out = Object.create(null)
  if (!header) return out
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    const key = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    out[key] = decodeURIComponent(value)
  }
  return out
}

function cookieHeader(token, secure) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

function clearCookieHeader(secure) {
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

function requestSecure(req) {
  if (req.socket?.encrypted) return true
  const forwarded = req.headers['x-forwarded-proto']
  return forwarded === 'https'
}

function requestPath(req) {
  const raw = req.url ?? '/'
  return raw.split('?')[0]
}

function isAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie)
  return sessionValid(cookies[COOKIE_NAME])
}

function sendUnauthorized(res, opts = {}) {
  const status = opts.redirect ? 302 : 401
  const headers = {
    'Cache-Control': 'no-store',
    ...(opts.redirect ? { Location: '/login' } : { 'Content-Type': 'application/json; charset=utf-8' }),
  }
  res.writeHead(status, headers)
  res.end(opts.redirect ? undefined : JSON.stringify({ error: 'No autenticado' }))
}

function loginPageHtml(errorMessage) {
  const error = errorMessage
    ? `<p class="error">${escapeHtml(errorMessage)}</p>`
    : ''
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Acceso · Truper NOC CVE</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      font-family: "Segoe UI", system-ui, sans-serif;
      background: radial-gradient(1200px 600px at 20% -10%, #1d2a3a, transparent),
                  radial-gradient(900px 500px at 90% 10%, #2a1d1d, transparent), #111110;
      color: #f0efec;
    }
    form {
      width: min(100% - 32px, 380px); padding: 32px;
      background: #1a1a19; border: 1px solid rgba(240,239,236,0.12); border-radius: 12px;
    }
    h1 { margin: 0 0 8px; font-size: 20px; letter-spacing: 0.02em; }
    p.sub { margin: 0 0 24px; color: #c3c2b7; font-size: 14px; }
    label { display: block; font-size: 12px; color: #c3c2b7; margin: 0 0 8px; }
    input {
      width: 100%; margin: 0 0 16px; padding: 12px 14px; border-radius: 8px;
      border: 1px solid rgba(240,239,236,0.16); background: #111110; color: #f0efec; font-size: 15px;
    }
    input:focus { outline: 2px solid #3987e5; outline-offset: 1px; }
    button {
      width: 100%; margin-top: 8px; padding: 12px 16px; border: 0; border-radius: 8px;
      background: #3987e5; color: #fff; font-weight: 700; font-size: 14px; cursor: pointer;
    }
    button:hover { filter: brightness(1.08); }
    button:active { transform: translateY(1px); }
    .error { color: #ff8f8f; background: rgba(208,59,59,0.15); padding: 10px 12px; border-radius: 8px; font-size: 13px; }
  </style>
</head>
<body>
  <form method="POST" action="/api/auth/login" autocomplete="username">
    <h1>Truper · NOC CVE</h1>
    <p class="sub">Vista privada — inicia sesión para continuar</p>
    ${error}
    <label for="username">Usuario</label>
    <input id="username" name="username" required autofocus />
    <label for="password">Contraseña</label>
    <input id="password" name="password" type="password" required autocomplete="current-password" />
    <button type="submit">Entrar</button>
  </form>
</body>
</html>`
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function readBodyText(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

function parseLoginBody(raw, contentType) {
  if ((contentType ?? '').includes('application/json')) {
    try {
      const data = JSON.parse(raw)
      return { username: String(data.username ?? ''), password: String(data.password ?? '') }
    } catch {
      return { username: '', password: '' }
    }
  }
  const params = new URLSearchParams(raw)
  return {
    username: params.get('username') ?? '',
    password: params.get('password') ?? '',
  }
}

async function handleLogin(req, res) {
  const raw = await readBodyText(req)
  const { username, password } = parseLoginBody(raw, req.headers['content-type'])
  const secure = requestSecure(req)
  if (!credentialsMatch(username, password)) {
    res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(loginPageHtml('Usuario o contraseña incorrectos'))
    return true
  }
  const token = createSession()
  res.writeHead(302, {
    Location: '/',
    'Set-Cookie': cookieHeader(token, secure),
    'Cache-Control': 'no-store',
  })
  res.end()
  return true
}

function handleLogout(req, res) {
  const cookies = parseCookies(req.headers.cookie)
  const token = cookies[COOKIE_NAME]
  if (token) sessions.delete(token)
  res.writeHead(302, {
    Location: '/login',
    'Set-Cookie': clearCookieHeader(requestSecure(req)),
    'Cache-Control': 'no-store',
  })
  res.end()
  return true
}

function serveLoginPage(res, errorMessage) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(loginPageHtml(errorMessage))
}

/**
 * Gate de autenticación. Devuelve true si ya respondió la petición.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
export async function handleAuthRequest(req, res) {
  const method = (req.method ?? 'GET').toUpperCase()
  const pathname = requestPath(req)

  if (pathname === '/login' && method === 'GET') {
    if (isAuthenticated(req)) {
      res.writeHead(302, { Location: '/' }).end()
      return true
    }
    serveLoginPage(res)
    return true
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    await handleLogin(req, res)
    return true
  }

  if (pathname === '/api/auth/logout' && (method === 'POST' || method === 'GET')) {
    handleLogout(req, res)
    return true
  }

  if (isAuthenticated(req)) return false

  // Solo redirigir navegación de documento. Scripts/módulos (.tsx/.js) no deben
  // recibir el HTML de /login (rompe type=module con MIME incorrecto).
  if (isDocumentNavigation(req, pathname)) {
    sendUnauthorized(res, { redirect: true })
    return true
  }
  sendUnauthorized(res)
  return true
}

function isAssetOrModulePath(pathname) {
  return pathname.startsWith('/@vite')
    || pathname.startsWith('/@fs')
    || pathname.startsWith('/@id')
    || pathname.startsWith('/@react-refresh')
    || pathname.startsWith('/src/')
    || pathname.startsWith('/assets/')
    || pathname.startsWith('/node_modules/')
    || pathname.startsWith('/config/')
    || /\.(tsx?|jsx?|mjs|cjs|css|map|wasm|json|svg|png|ico|woff2?)(\?|$)/i.test(pathname)
}

function isDocumentNavigation(req, pathname) {
  if (isAssetOrModulePath(pathname)) return false
  const fetchDest = String(req.headers['sec-fetch-dest'] ?? '')
  if (fetchDest === 'document') return true
  if (fetchDest && fetchDest !== 'document') return false
  return String(req.headers.accept ?? '').includes('text/html')
}

/** Fingerprint estable solo para logs (no es secreto). */
export function authConfigFingerprint() {
  const { username } = authCredentials()
  return createHash('sha256').update(username).digest('hex').slice(0, 8)
}
