import { daysAgo, getJson, normalizeSeverity } from '../lib/http'
import type { PartialCve } from '../types'

// GitHub Global Security Advisories — https://docs.github.com/rest/security-advisories/global-advisories
// Sin token: 60 req/h. Paginación por cursor en el header Link (param `after`).

interface GhAdvisory {
  ghsa_id: string
  cve_id: string | null
  html_url: string
  summary: string
  description: string | null
  severity: 'critical' | 'high' | 'medium' | 'low' | 'unknown'
  published_at: string
  updated_at: string
  references?: string[]
  cvss?: { score: number | null; vector_string: string | null } | null
  cvss_severities?: {
    cvss_v3?: { score: number | null } | null
    cvss_v4?: { score: number | null } | null
  }
  cwes?: { cwe_id: string }[]
  vulnerabilities?: { package?: { ecosystem: string; name: string } | null }[]
}

const MAX_PAGES = 5

function nextCursor(link: string | null): string | null {
  if (!link) return null
  const next = link.split(',').find((p) => p.includes('rel="next"'))
  const url = next?.match(/<([^>]+)>/)?.[1]
  return url ? new URL(url).searchParams.get('after') : null
}

export function mapGithub(a: GhAdvisory): PartialCve {
  const v4 = a.cvss_severities?.cvss_v4?.score
  const v3 = a.cvss_severities?.cvss_v3?.score ?? a.cvss?.score
  const score = v4 || v3 || undefined
  const packages = (a.vulnerabilities ?? [])
    .map((v) => v.package && `${v.package.ecosystem}:${v.package.name}`)
    .filter((p): p is string => Boolean(p))
  return {
    id: a.cve_id ?? a.ghsa_id,
    aliases: a.cve_id ? [a.ghsa_id] : [],
    title: a.summary,
    description: a.description?.split('\n').find((l) => l.trim() && !l.startsWith('#')) ?? a.summary,
    severity: normalizeSeverity(a.severity),
    cvss: score,
    cvssVersion: v4 ? '4.0' : v3 ? '3.x' : undefined,
    published: a.published_at,
    modified: a.updated_at,
    cwes: (a.cwes ?? []).map((c) => c.cwe_id),
    packages: [...new Set(packages)],
    references: [a.html_url, ...(a.references ?? [])],
    sources: ['github'],
  }
}

export async function fetchGithub(days: number, signal?: AbortSignal): Promise<PartialCve[]> {
  const since = daysAgo(days).toISOString().slice(0, 10)
  const params = new URLSearchParams({
    type: 'reviewed',
    per_page: '100',
    sort: 'published',
    direction: 'desc',
    published: `>=${since}`,
  })
  const out: PartialCve[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, headers } = await getJson<GhAdvisory[]>(`/api/github?${params}`, signal)
    out.push(...data.map(mapGithub))
    const after = nextCursor(headers.get('link'))
    if (!after || data.length === 0) break
    params.set('after', after)
  }
  return out
}
