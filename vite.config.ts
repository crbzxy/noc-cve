import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from 'vite'
import { upstreams } from './proxy.config.mjs'

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

/** Expone /api/corpus* en Vite dev con el mismo store de producción. */
function corpusDevPlugin(): Plugin {
  return {
    name: 'noc-cve-corpus',
    configureServer(devServer) {
      const storeImport = import('./server/corpus/store.mjs' as string) as Promise<{
        startCorpusWorker: (options: {
          startTimer?: boolean
          ingestOnBoot?: boolean
        }) => Promise<void>
      }>

      // Ingesta directa a upstreams (sin loopback al propio Vite).
      void storeImport.then(async ({ startCorpusWorker }) => {
        await startCorpusWorker({ startTimer: true, ingestOnBoot: true })
      }).catch((error: unknown) => {
        console.error('[corpus] Worker dev no iniciado:', error)
      })

      devServer.middlewares.use((req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
        const httpImport = import('./server/corpus/http.mjs' as string) as Promise<{
          handleCorpusRequest: (req: IncomingMessage, res: ServerResponse) => boolean
        }>
        void httpImport.then(({ handleCorpusRequest }) => {
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

  return {
    plugins: [react(), corpusDevPlugin()],
    server: { host: '127.0.0.1', proxy, port: 5173 },
    preview: { host: '127.0.0.1', proxy },
  }
})
