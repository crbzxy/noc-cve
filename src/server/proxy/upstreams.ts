import { readFileSync } from 'fs'
import { join } from 'path'

export type Upstream = {
  id: string
  target: string
  path: string
  headers: (env: NodeJS.ProcessEnv) => Record<string, string>
}

type SourceRow = {
  id: string
  proxyPrefix: string
  baseUrl: string
  path?: string
  authEnv?: string
  format?: string
}

function acceptForFormat(format?: string): string {
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

function isLocalHttp(url: string) {
  return url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')
}

export function requireHttpsTarget(url: string, label = 'baseUrl') {
  if (!url) throw new Error(`${label} vacío: se requiere https://`)
  if (url.startsWith('https://') || isLocalHttp(url)) return url
  if (url.startsWith('http://')) return `https://${url.slice('http://'.length)}`
  throw new Error(`${label} inválido (${url}): debe empezar con https://`)
}

function resolveTarget(url: string) {
  const mock = process.env.MOCK_UPSTREAM
  return requireHttpsTarget(mock ?? url)
}

function headersFor(source: SourceRow) {
  return (env: NodeJS.ProcessEnv) => {
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
    if (source.authEnv && env[source.authEnv]) {
      return { ...base, Authorization: `Bearer ${env[source.authEnv]}` }
    }
    return base
  }
}

function loadSources(): SourceRow[] {
  const configPath = join(process.cwd(), 'config', 'sources.json')
  const config = JSON.parse(readFileSync(configPath, 'utf8')) as { sources: SourceRow[] }
  return config.sources
}

function buildUpstreams(): Record<string, Upstream> {
  const sourceUpstreams = Object.fromEntries(
    loadSources().map((source) => [
      source.proxyPrefix,
      {
        id: source.id,
        target: resolveTarget(source.baseUrl),
        path: source.path ?? '',
        headers: headersFor(source),
      } satisfies Upstream,
    ]),
  )

  const catalogUpstreams: Record<string, Upstream> = {
    '/api/maven-central': {
      id: 'maven-central',
      target: resolveTarget('https://repo1.maven.org'),
      path: '/maven2',
      headers: () => ({
        Accept: 'application/xml,text/xml,*/*',
        'User-Agent': 'noc-cve-dashboard',
      }),
    },
    '/api/npm-registry': {
      id: 'npm-registry',
      target: resolveTarget('https://registry.npmjs.org'),
      path: '',
      headers: () => ({
        Accept: 'application/json',
        'User-Agent': 'noc-cve-dashboard',
      }),
    },
    '/api/pypi': {
      id: 'pypi',
      target: resolveTarget('https://pypi.org'),
      path: '/pypi',
      headers: () => ({
        Accept: 'application/json',
        'User-Agent': 'noc-cve-dashboard',
      }),
    },
    '/api/go-proxy': {
      id: 'go-proxy',
      target: resolveTarget('https://proxy.golang.org'),
      path: '',
      headers: () => ({
        Accept: 'application/json',
        'User-Agent': 'noc-cve-dashboard',
      }),
    },
  }

  return { ...sourceUpstreams, ...catalogUpstreams }
}

let cached: Record<string, Upstream> | null = null

export function getUpstreams(): Record<string, Upstream> {
  if (!cached) cached = buildUpstreams()
  return cached
}

export function matchUpstream(pathname: string): { prefix: string; upstream: Upstream; rest: string } | null {
  const prefixes = Object.keys(getUpstreams()).sort((a, b) => b.length - a.length)
  for (const prefix of prefixes) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}?`)) {
      return {
        prefix,
        upstream: getUpstreams()[prefix],
        rest: pathname.slice(prefix.length),
      }
    }
  }
  return null
}

export function egressHostsFromConfig(): Array<{
  id: string
  label: string
  host: string
  role: string
  authEnv?: string
  authRequired?: boolean
}> {
  const configPath = join(process.cwd(), 'config', 'sources.json')
  const config = JSON.parse(readFileSync(configPath, 'utf8')) as {
    sources: Array<{
      id: string
      label: string
      baseUrl: string
      role: string
      authEnv?: string
      authRequired?: boolean
    }>
  }
  type EgressSource = {
    id: string
    label: string
    baseUrl: string
    role: string
    authEnv?: string
    authRequired?: boolean
  }
  const catalog: EgressSource[] = [
    { id: 'maven-central', label: 'Maven Central', baseUrl: 'https://repo1.maven.org', role: 'catalog' },
    { id: 'npm-registry', label: 'npm registry', baseUrl: 'https://registry.npmjs.org', role: 'catalog' },
    { id: 'pypi', label: 'PyPI', baseUrl: 'https://pypi.org', role: 'catalog' },
    { id: 'go-proxy', label: 'Go module proxy', baseUrl: 'https://proxy.golang.org', role: 'catalog' },
  ]
  return [...config.sources, ...catalog].map((source) => ({
    id: source.id,
    label: source.label,
    host: new URL(source.baseUrl).host,
    role: source.role,
    authEnv: source.authEnv,
    authRequired: source.authRequired,
  }))
}
