// Reescribe /api/* del worker de corpus hacia upstreams reales.
// Evita auto-fetch al propio Vite/Node (rompe undici en Node 24).
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { upstreams } from '../../proxy.config.mjs'

const INTERNAL_ORIGIN = 'http://corpus.internal'
const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

function loadDotEnv() {
  const envPath = join(rootDir, '.env')
  if (!existsSync(envPath)) return
  const text = readFileSync(envPath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function rewriteUrl(urlString) {
  let url
  try {
    url = new URL(urlString)
  } catch {
    return null
  }
  if (url.origin !== INTERNAL_ORIGIN) return null

  const pathnameWithQuery = `${url.pathname}${url.search}`
  const prefixes = Object.keys(upstreams).sort((a, b) => b.length - a.length)
  for (const prefix of prefixes) {
    if (pathnameWithQuery === prefix || pathnameWithQuery.startsWith(`${prefix}/`) || pathnameWithQuery.startsWith(`${prefix}?`)) {
      const rest = pathnameWithQuery.slice(prefix.length)
      const upstream = upstreams[prefix]
      return {
        target: `${upstream.target}${upstream.path}${rest}`,
        headers: upstream.headers(process.env),
      }
    }
  }
  return null
}

let installed = false

/** Instala fetch directo a fuentes; devuelve el origin interno a usar como CORPUS_API_BASE. */
export function installDirectCorpusFetch() {
  loadDotEnv()
  if (installed) return INTERNAL_ORIGIN
  installed = true

  const originalFetch = globalThis.fetch.bind(globalThis)
  globalThis.fetch = async (input, init = {}) => {
    const urlString = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url

    const rewritten = rewriteUrl(urlString)
    if (!rewritten) return originalFetch(input, init)

    const inbound = new Headers(init.headers ?? (typeof input !== 'string' && !(input instanceof URL) ? input.headers : undefined))
    const headers = new Headers(rewritten.headers)
    inbound.forEach((value, key) => {
      // No pisar auth/apiKey del upstream con Accept genérico del cliente.
      if (!headers.has(key) || key.toLowerCase() === 'content-type' || key.toLowerCase() === 'accept') {
        if (key.toLowerCase() === 'content-type' || key.toLowerCase() === 'accept') {
          headers.set(key, value)
        } else if (!headers.has(key)) {
          headers.set(key, value)
        }
      }
    })

    return originalFetch(rewritten.target, {
      ...init,
      headers,
    })
  }

  return INTERNAL_ORIGIN
}

export { INTERNAL_ORIGIN }
