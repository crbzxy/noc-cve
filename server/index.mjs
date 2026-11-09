// Servidor de producción sin dependencias: sirve dist/ y hace proxy a las fuentes.
// Uso: npm run build && npm start
// HTTPS por defecto si hay TLS_CERT/TLS_KEY o certs/cert.pem+key.pem (npm run tls:init).
import { existsSync, readFileSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { createServer as createHttpServer } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { requireHttpsTarget, upstreams } from '../proxy.config.mjs'
import { handleCorpusRequest } from './corpus/http.mjs'
import { startCorpusWorker } from './corpus/store.mjs'

const rootDir = dirname(fileURLToPath(import.meta.url))
const distRoot = fileURLToPath(new URL('../dist', import.meta.url))
const port = Number(process.env.PORT ?? 8080)
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS ?? 25_000)
const allowHttp = process.env.ALLOW_HTTP === '1'

function resolveTlsMaterial() {
  const envCert = process.env.TLS_CERT
  const envKey = process.env.TLS_KEY
  if (envCert && envKey && existsSync(envCert) && existsSync(envKey)) {
    return { cert: readFileSync(envCert), key: readFileSync(envKey), source: 'env' }
  }
  const localCert = join(rootDir, '..', 'certs', 'cert.pem')
  const localKey = join(rootDir, '..', 'certs', 'key.pem')
  if (existsSync(localCert) && existsSync(localKey)) {
    return { cert: readFileSync(localCert), key: readFileSync(localKey), source: 'certs/' }
  }
  return null
}

const tls = resolveTlsMaterial()
const useTls = Boolean(tls) && !allowHttp
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon',
}

const cache = new Map()
const TTL_MS = 60_000

function jsonError(status, payload) {
  return {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: Buffer.from(JSON.stringify(payload)),
  }
}

function isLocalHttp(url) {
  return url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')
}

async function readRequestBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
}

async function proxy(req, res, prefix, up) {
  const rest = req.url.slice(prefix.length)
  const method = (req.method ?? 'GET').toUpperCase()
  let url
  try {
    const target = requireHttpsTarget(up.target, `upstream ${prefix}`)
    url = target + up.path + rest
    if (!url.startsWith('https://') && !isLocalHttp(url)) {
      throw new Error(`Solo se permiten upstreams HTTPS (${url})`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const err = jsonError(500, { error: message })
    res.writeHead(err.status, err.headers).end(err.body)
    return
  }

  const cacheable = method === 'GET' || method === 'HEAD'
  const hit = cacheable ? cache.get(url) : undefined
  if (hit && Date.now() - hit.at < TTL_MS) {
    res.writeHead(200, hit.headers).end(hit.body)
    return
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  try {
    const requestHeaders = {
      Accept: 'application/json',
      'User-Agent': 'noc-cve-dashboard',
      ...up.headers(process.env),
    }
    const inboundType = req.headers['content-type']
    if (inboundType) requestHeaders['Content-Type'] = inboundType
    const body = method === 'GET' || method === 'HEAD' ? undefined : await readRequestBody(req)
    const r = await fetch(url, {
      method,
      headers: requestHeaders,
      body,
      signal: controller.signal,
    })
    const responseBody = Buffer.from(await r.arrayBuffer())
    if (!r.ok) {
      const detail = responseBody.length
        ? responseBody.toString('utf8').slice(0, 500)
        : `Upstream respondió ${r.status} sin cuerpo (¿firewall hacia ${up.target}?)`
      const err = jsonError(502, {
        error: `No se pudo consultar ${up.target}${up.path}`,
        status: r.status,
        detail,
        upstream: url.split('?')[0],
      })
      res.writeHead(err.status, err.headers).end(err.body)
      return
    }
    const headers = { 'content-type': r.headers.get('content-type') ?? 'application/json' }
    const link = r.headers.get('link')
    if (link) headers.link = link
    if (cacheable) cache.set(url, { at: Date.now(), body: responseBody, headers })
    res.writeHead(r.status, headers).end(responseBody)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const aborted = controller.signal.aborted
    const err = jsonError(502, {
      error: aborted
        ? `Timeout (${UPSTREAM_TIMEOUT_MS} ms) al consultar ${up.target}`
        : `Fallo de red hacia ${up.target}: ${message}`,
      hint: `Verifica salida HTTPS desde el servidor QA hacia ${up.target} (firewall / proxy corporativo).`,
      upstream: `${up.target}${up.path}`,
    })
    res.writeHead(err.status, err.headers).end(err.body)
  } finally {
    clearTimeout(timer)
  }
}

async function serveStatic(req, res) {
  const clean = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '')
  let file = join(distRoot, clean)
  try {
    if (!(await stat(file)).isFile()) throw new Error()
  } catch {
    file = join(distRoot, 'index.html')
  }
  const data = await readFile(file)
  res.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream' }).end(data)
}

function onRequest(req, res) {
  if (handleCorpusRequest(req, res)) return
  const match = Object.entries(upstreams).find(([p]) => req.url === p || req.url.startsWith(p + '/') || req.url.startsWith(p + '?'))
  if (match) return proxy(req, res, match[0], match[1])
  serveStatic(req, res).catch(() => res.writeHead(500).end())
}

function redirectToHttps(req, res) {
  const host = (req.headers.host ?? `localhost:${port}`).replace(/:\d+$/, `:${port}`)
  res.writeHead(301, { Location: `https://${host}${req.url ?? '/'}` }).end()
}

if (!useTls) {
  console.warn('Sin TLS_CERT/TLS_KEY ni certs/*.pem — escuchando HTTP.')
  console.warn('En QA: npm run tls:init && npm start  (o define PEM corporativos).')
  if (process.env.FORCE_HTTPS === '1' && !allowHttp) process.exit(1)
}

const server = useTls
  ? createHttpsServer({ cert: tls.cert, key: tls.key }, onRequest)
  : createHttpServer(onRequest)

server.listen(port, () => {
  const scheme = useTls ? 'https' : 'http'
  console.log(`NOC CVE dashboard → ${scheme}://localhost:${port}${useTls ? ` (TLS: ${tls.source})` : ''}`)
  startCorpusWorker({ startTimer: true, ingestOnBoot: true }).catch((error) => {
    console.error('[corpus] No se pudo iniciar worker:', error)
  })
})

const redirectPort = Number(process.env.HTTP_REDIRECT_PORT ?? 0)
if (useTls && redirectPort > 0) {
  createHttpServer(redirectToHttps).listen(redirectPort, () => {
    console.log(`Redirect HTTP :${redirectPort} → HTTPS :${port}`)
  })
}
