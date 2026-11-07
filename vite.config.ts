import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import { upstreams } from './proxy.config.mjs'

export default defineConfig(({ mode }) => {
  // Carga .env sin prefijo VITE_ (solo disponible en Node, no en el cliente)
  const env = loadEnv(mode, process.cwd(), '')

  const proxy: Record<string, ProxyOptions> = {}
  for (const [prefix, up] of Object.entries(upstreams)) {
    proxy[prefix] = {
      target: up.target,
      changeOrigin: true,
      secure: true,
      headers: up.headers(env),
      rewrite: (p) => up.path + p.slice(prefix.length),
    }
  }

  return {
    plugins: [react()],
    server: { proxy, port: 5173 },
    preview: { proxy },
  }
})
