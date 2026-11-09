import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from 'vite'
import { upstreams } from './proxy.config.mjs'

/** Import nativo (evita que Vite reescriba rutas a `.vite-temp`). */
function importServerModule<T>(relativePath: string): Promise<T> {
  const absolute = join(process.cwd(), relativePath)
  return import(pathToFileURL(absolute).href) as Promise<T>
}

function writeProxyError(
  res: ServerResponse | undefined,
  target: string,
  path: string,
  err: unknown,
) {
  if (!res || res.headersSent || typeof res.writeHead !== 'function') return
  const detail = err instanceof Error ? err.message : String(err)
  const payload = JSON.stringify({
    error: `Fallo de red hacia ${target}`,
    detail,
    hint: `Verifica salida HTTPS desde este host hacia ${target} (firewall / proxy corporativo).`,
    upstream: `${target}${path}`,
  })
  res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(payload)
}

/** Login + cookie de sesión en Vite (misma puerta que producción). */
function authDevPlugin(): Plugin {
  const attach = (middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void) => void }) => {
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
      // Ingesta directa a upstreams (sin loopback al propio Vite).
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

      devServer.middlewares.use((req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
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
  // Carga .env sin prefijo VITE_ (solo disponible en Node, no en el cliente)
  const env = loadEnv(mode, process.cwd(), '')

  const proxy: Record<string, ProxyOptions> = {}
  for (const [prefix, up] of Object.entries(upstreams)) {
    proxy[prefix] = {
      target: up.target,
      changeOrigin: true,
      secure: true,
      timeout: 30_000,
      proxyTimeout: 30_000,
      headers: up.headers(env),
      rewrite: (path) => up.path + path.slice(prefix.length),
      configure: (proxyServer) => {
        proxyServer.on('error', (err, _req, res) => {
          writeProxyError(res as ServerResponse | undefined, up.target, up.path, err)
        })
      },
    }
  }

  // En Docker/QA usar 0.0.0.0 (VITE_DEV_HOST); en local también sirve para LAN.
  const host = env.VITE_DEV_HOST || process.env.VITE_DEV_HOST || '0.0.0.0'

  return {
    plugins: [react(), authDevPlugin(), corpusDevPlugin()],
    server: { host, proxy, port: 5173 },
    preview: { host, proxy },
  }
})
