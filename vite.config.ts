import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'
import { describeFetchFailure, httpErrorPayload, networkErrorPayload } from './proxy.errors.mjs'
import { upstreams } from './proxy.config.mjs'

/** Import nativo (evita que Vite reescriba rutas a `.vite-temp`). */
function importServerModule<T>(relativePath: string): Promise<T> {
  const absolute = join(process.cwd(), relativePath)
  return import(pathToFileURL(absolute).href) as Promise<T>
}

type Upstream = {
  target: string
  path: string
  headers: (env: Record<string, string | undefined>) => Record<string, string>
}

function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function writeJsonError(
  res: ServerResponse,
  status: number,
  payload: Record<string, unknown>,
) {
  if (res.headersSent) return
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

/**
 * Proxy con fetch nativo (igual que server/index.mjs y el corpus).
 * Evita el http-proxy de Vite, que falla TLS con inspección SSL aunque fetch sí funcione.
 */
function fetchUpstreamProxyPlugin(env: Record<string, string>): Plugin {
  const prefixes = Object.keys(upstreams).sort((a, b) => b.length - a.length)

  const attach = (middlewares: Connect.Server) => {
    middlewares.use((req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
      const requestUrl = req.url ?? ''
      const prefix = prefixes.find((item) => (
        requestUrl === item
        || requestUrl.startsWith(`${item}/`)
        || requestUrl.startsWith(`${item}?`)
      ))
      if (!prefix) {
        next()
        return
      }

      const up = upstreams[prefix] as Upstream
      const method = (req.method ?? 'GET').toUpperCase()
      const rest = requestUrl.slice(prefix.length)
      const targetUrl = `${up.target}${up.path}${rest}`

      const timeoutMs = Number(env.UPSTREAM_TIMEOUT_MS ?? process.env.UPSTREAM_TIMEOUT_MS ?? 30_000)

      void (async () => {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)
        try {
          const requestHeaders: Record<string, string> = {
            Accept: 'application/json',
            'User-Agent': 'noc-cve-dashboard',
            ...up.headers({ ...process.env, ...env }),
          }
          const inboundType = req.headers['content-type']
          if (typeof inboundType === 'string') requestHeaders['Content-Type'] = inboundType

          const body = method === 'GET' || method === 'HEAD'
            ? undefined
            : await readRequestBody(req)

          const upstream = await fetch(targetUrl, {
            method,
            headers: requestHeaders,
            body,
            signal: controller.signal,
          })
          const responseBody = Buffer.from(await upstream.arrayBuffer())
          if (!upstream.ok) {
            const detail = responseBody.length
              ? responseBody.toString('utf8').slice(0, 500)
              : `Upstream ${upstream.status} sin cuerpo (¿firewall hacia ${up.target}?)`
            writeJsonError(
              res,
              502,
              httpErrorPayload(up.target, up.path, upstream.status, detail, targetUrl),
            )
            return
          }
          const headers: Record<string, string> = {
            'content-type': upstream.headers.get('content-type') ?? 'application/json',
          }
          const link = upstream.headers.get('link')
          if (link) headers.link = link
          res.writeHead(upstream.status, headers)
          res.end(responseBody)
        } catch (error) {
          writeJsonError(
            res,
            502,
            networkErrorPayload(up.target, describeFetchFailure(error), {
              aborted: controller.signal.aborted,
              timeoutMs,
              path: up.path,
            }),
          )
        } finally {
          clearTimeout(timer)
        }
      })().catch((error: unknown) => {
        next(error instanceof Error ? error : new Error(String(error)))
      })
    })
  }

  return {
    name: 'noc-cve-fetch-proxy',
    configureServer(devServer) {
      attach(devServer.middlewares)
    },
    configurePreviewServer(previewServer) {
      attach(previewServer.middlewares)
    },
  }
}

/** Login + cookie de sesión en Vite (misma puerta que producción). */
function authDevPlugin(): Plugin {
  const attach = (middlewares: Connect.Server) => {
    middlewares.use((req, res, next) => {
      void importServerModule<{
        handleAuthRequest: (req: IncomingMessage, res: ServerResponse) => Promise<boolean>
      }>('server/auth.mjs').then(async (mod) => {
        const handled = await mod.handleAuthRequest(req, res)
        if (!handled) next()
      }).catch(next)
    })
  }

  return {
    name: 'noc-cve-auth',
    configureServer(devServer) {
      attach(devServer.middlewares)
    },
    configurePreviewServer(previewServer) {
      attach(previewServer.middlewares)
    },
  }
}

/** Expone /api/corpus* en Vite dev con el mismo store de producción. */
function corpusDevPlugin(): Plugin {
  return {
    name: 'noc-cve-corpus',
    configureServer(devServer) {
      void importServerModule<{
        startCorpusWorker: (options: {
          startTimer?: boolean
          ingestOnBoot?: boolean
        }) => Promise<void>
      }>('server/corpus/store.mjs').then(async ({ startCorpusWorker }) => {
        await startCorpusWorker({ startTimer: true, ingestOnBoot: true })
      }).catch((error: unknown) => {
        console.error('[corpus] Worker dev no iniciado:', error)
      })

      devServer.middlewares.use((req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
        void importServerModule<{
          handleCorpusRequest: (req: IncomingMessage, res: ServerResponse) => boolean
        }>('server/corpus/http.mjs').then(({ handleCorpusRequest }) => {
          if (handleCorpusRequest(req, res)) return
          next()
        }).catch(next)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)
  const host = env.VITE_DEV_HOST || process.env.VITE_DEV_HOST || '0.0.0.0'

  return {
    plugins: [
      react({ compiler: true }),
      authDevPlugin(),
      corpusDevPlugin(),
      // Después de corpus: /api/osv etc. van por fetch, no por http-proxy de Vite.
      fetchUpstreamProxyPlugin(env),
    ],
    server: { host, port: 5173 },
    preview: { host },
  }
})
