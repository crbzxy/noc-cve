import react from '@vitejs/plugin-react'
import type { ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
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
    plugins: [react()],
    server: { proxy, port: 5173 },
    preview: { proxy },
  }
})
