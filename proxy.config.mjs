// Upstreams compartidos por Vite (dev) y server/index.mjs (prod).
// SSOT: config/sources.json (baseUrl, path, proxyPrefix). Secrets solo en .env.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const config = JSON.parse(readFileSync(join(root, 'config', 'sources.json'), 'utf8'))

const mock = globalThis.process?.env?.MOCK_UPSTREAM

function isLocalHttp(url) {
  return url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')
}

/** Solo HTTPS hacia fuentes externas; HTTP queda permitido únicamente en mock local. */
export function requireHttpsTarget(url, label = 'baseUrl') {
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error(`${label} vacío: se requiere https://`)
  }
  if (url.startsWith('https://') || isLocalHttp(url)) return url
  if (url.startsWith('http://')) {
    return `https://${url.slice('http://'.length)}`
  }
  throw new Error(`${label} inválido (${url}): debe empezar con https://`)
}

const resolveTarget = (url) => requireHttpsTarget(mock ?? url)

function bearerFromEnv(env, authEnv) {
  if (!authEnv) return undefined
  const token = env[authEnv]
  return token ? `Bearer ${token}` : undefined
}

function acceptForFormat(format) {
  switch (format) {
    case 'rss':
      return 'application/rss+xml, application/xml;q=0.9, */*;q=0.8'
    case 'atom':
      return 'application/atom+xml, application/xml;q=0.9, */*;q=0.8'
    case 'cvrf':
      // API v3 de MSRC es JSON; pedir XML hace que responda CVRF XML.
      return 'application/json'
    case 'csaf':
    case 'jsonfeed':
    case 'json':
    default:
      return 'application/json'
  }
}

function headersFor(source) {
  return (env) => {
    const base = {
      Accept: acceptForFormat(source.format),
      'User-Agent': 'noc-cve-dashboard',
    }
    if (source.id === 'github') {
      return {
        ...base,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}),
      }
    }
    if (source.authEnv === 'NVD_API_KEY' && env.NVD_API_KEY) {
      return { ...base, apiKey: env.NVD_API_KEY }
    }
    const bearer = bearerFromEnv(env, source.authEnv)
    if (bearer) return { ...base, Authorization: bearer }
    return base
  }
}

export const sourcesConfig = config

/** @type {Record<string, { target: string, path: string, headers: (env: Record<string, string | undefined>) => Record<string, string> }>} */
const sourceUpstreams = Object.fromEntries(
  config.sources.map((source) => [
    source.proxyPrefix,
    {
      target: resolveTarget(source.baseUrl),
      path: source.path ?? '',
      headers: headersFor(source),
    },
  ]),
)

/** Proxies auxiliares: catálogos de versión (no son fuentes CVE). */
const catalogUpstreams = {
  '/api/maven-central': {
    target: resolveTarget('https://repo1.maven.org'),
    path: '/maven2',
    headers: () => ({
      Accept: 'application/xml,text/xml,*/*',
      'User-Agent': 'noc-cve-dashboard',
    }),
  },
  '/api/npm-registry': {
    target: resolveTarget('https://registry.npmjs.org'),
    path: '',
    headers: () => ({
      Accept: 'application/json',
      'User-Agent': 'noc-cve-dashboard',
    }),
  },
  '/api/pypi': {
    target: resolveTarget('https://pypi.org'),
    path: '/pypi',
    headers: () => ({
      Accept: 'application/json',
      'User-Agent': 'noc-cve-dashboard',
    }),
  },
  '/api/go-proxy': {
    target: resolveTarget('https://proxy.golang.org'),
    path: '',
    headers: () => ({
      Accept: 'application/json',
      'User-Agent': 'noc-cve-dashboard',
    }),
  },
}

export const upstreams = {
  ...sourceUpstreams,
  ...catalogUpstreams,
}
