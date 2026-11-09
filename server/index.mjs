// Servidor de producción sin dependencias: sirve dist/ y hace proxy a las fuentes.
// Uso: npm run build && npm start   (lee NVD_API_KEY / GITHUB_TOKEN / PORT del entorno)
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { upstreams } from '../proxy.config.mjs'

const root = fileURLToPath(new URL('../dist', import.meta.url))
const port = Number(process.env.PORT ?? 8080)
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS ?? 25_000)
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

async function proxy(req, res, prefix, up) {
  const rest = req.url.slice(prefix.length)
  const url = up.target + up.path + rest
  const hit = cache.get(url)
  if (hit && Date.now() - hit.at < TTL_MS) {
    res.writeHead(200, hit.headers).end(hit.body)
    return
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  try {
    const r = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'noc-cve-dashboard',
        ...up.headers(process.env),
      },
      signal: controller.signal,
    })
    const body = Buffer.from(await r.arrayBuffer())
    if (!r.ok) {
      const detail = body.length
        ? body.toString('utf8').slice(0, 500)
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
    cache.set(url, { at: Date.now(), body, headers })
    res.writeHead(r.status, headers).end(body)
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
  let file = join(root, clean)
  try {
    if (!(await stat(file)).isFile()) throw new Error()
  } catch {
    file = join(root, 'index.html')
  }
  const data = await readFile(file)
  res.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream' }).end(data)
}

createServer((req, res) => {
  const match = Object.entries(upstreams).find(([p]) => req.url === p || req.url.startsWith(p + '/') || req.url.startsWith(p + '?'))
  if (match) return proxy(req, res, match[0], match[1])
  serveStatic(req, res).catch(() => res.writeHead(500).end())
}).listen(port, () => console.log(`NOC CVE dashboard → http://localhost:${port}`))
