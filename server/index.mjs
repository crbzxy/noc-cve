// Servidor de producción sin dependencias: sirve dist/ y hace proxy a las fuentes.
// Uso: npm run build && npm start   (lee NVD_API_KEY / GITHUB_TOKEN / PORT del entorno)
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { upstreams } from '../proxy.config.mjs'

const root = fileURLToPath(new URL('../dist', import.meta.url))
const port = Number(process.env.PORT ?? 8080)
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon',
}

// Cache corto en memoria para no quemar rate limits (NVD: 5 req/30 s sin key; GitHub: 60 req/h)
const cache = new Map()
const TTL_MS = 60_000

async function proxy(req, res, prefix, up) {
  const rest = req.url.slice(prefix.length)
  const url = up.target + up.path + rest
  const hit = cache.get(url)
  if (hit && Date.now() - hit.at < TTL_MS) {
    res.writeHead(200, hit.headers).end(hit.body)
    return
  }
  try {
    const r = await fetch(url, { headers: up.headers(process.env) })
    const body = Buffer.from(await r.arrayBuffer())
    const headers = { 'content-type': r.headers.get('content-type') ?? 'application/json' }
    const link = r.headers.get('link')
    if (link) headers.link = link
    if (r.ok) cache.set(url, { at: Date.now(), body, headers })
    res.writeHead(r.status, headers).end(body)
  } catch (e) {
    res.writeHead(502, { 'content-type': 'application/json' }).end(JSON.stringify({ error: String(e) }))
  }
}

async function serveStatic(req, res) {
  const clean = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '')
  let file = join(root, clean)
  try {
    if (!(await stat(file)).isFile()) throw new Error()
  } catch {
    file = join(root, 'index.html') // SPA fallback
  }
  const data = await readFile(file)
  res.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream' }).end(data)
}

createServer((req, res) => {
  const match = Object.entries(upstreams).find(([p]) => req.url === p || req.url.startsWith(p + '/') || req.url.startsWith(p + '?'))
  if (match) return proxy(req, res, match[0], match[1])
  serveStatic(req, res).catch(() => res.writeHead(500).end())
}).listen(port, () => console.log(`NOC CVE dashboard → http://localhost:${port}`))
