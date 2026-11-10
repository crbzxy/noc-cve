import { daysAgo, normalizeSeverity, postJson } from '../lib/http'
import type { PartialCve } from '../types'

// CVE.org Search API (beta) — POST https://www.cve.org/restapiv1/search
// Body: { query, from, size, sort }. Sin API key en beta.

interface CveMetric {
  cvssV4_0?: { baseScore?: number; baseSeverity?: string; version?: string }
  cvssV3_1?: { baseScore?: number; baseSeverity?: string; version?: string }
  cvssV3_0?: { baseScore?: number; baseSeverity?: string; version?: string }
  cvssV2_0?: { baseScore?: number; baseSeverity?: string; version?: string }
}

interface CveContainer {
  descriptions?: { lang: string; value: string }[]
  affected?: { vendor?: string; product?: string }[]
  problemTypes?: { descriptions?: { cweId?: string; lang?: string; description?: string }[] }[]
  references?: { url: string }[]
  metrics?: CveMetric[]
  title?: string
}

interface CveRecord51 {
  cveMetadata?: {
    cveId?: string
    state?: string
    datePublished?: string
    dateUpdated?: string
  }
  containers?: {
    cna?: CveContainer
    adp?: CveContainer[]
  }
}

interface SearchResponse {
  results?: CveRecord51[]
  resultsTotal?: number
  total?: number
  size?: number
  from?: number
  resultsPerPage?: number
  pageNumber?: number
}

const PAGE_SIZE = 100
const MAX_PAGES = 20
const MAX_WINDOW = 10_000

function pickMetric(container?: CveContainer): { score?: number; sev?: string; version?: string } {
  const metrics = container?.metrics ?? []
  for (const metric of metrics) {
    const data = metric.cvssV4_0 ?? metric.cvssV3_1 ?? metric.cvssV3_0 ?? metric.cvssV2_0
    if (!data?.baseScore && data?.baseScore !== 0) continue
    return {
      score: data.baseScore,
      sev: data.baseSeverity,
      version: data.version ?? (metric.cvssV4_0 ? '4.0' : metric.cvssV3_1 ? '3.1' : undefined),
    }
  }
  return {}
}

function pickDescription(container?: CveContainer): string {
  const list = container?.descriptions ?? []
  return list.find((item) => item.lang?.startsWith('en'))?.value ?? list[0]?.value ?? ''
}

function pickCwes(container?: CveContainer): string[] {
  return (container?.problemTypes ?? [])
    .flatMap((problem) => problem.descriptions ?? [])
    .map((item) => item.cweId)
    .filter((id): id is string => Boolean(id?.startsWith('CWE-')))
}

function mapRecord(record: CveRecord51): PartialCve | null {
  const id = record.cveMetadata?.cveId
  if (!id?.startsWith('CVE-')) return null
  const cna = record.containers?.cna
  const metric = pickMetric(cna)
  const packages = (cna?.affected ?? [])
    .map((item) => item.vendor && item.product ? `${item.vendor}:${item.product}` : item.product)
    .filter((value): value is string => Boolean(value))
  return {
    id,
    title: cna?.title,
    description: pickDescription(cna),
    severity: normalizeSeverity(metric.sev),
    cvss: metric.score,
    cvssVersion: metric.version,
    published: record.cveMetadata?.datePublished,
    modified: record.cveMetadata?.dateUpdated,
    status: record.cveMetadata?.state,
    packages: [...new Set(packages)],
    cwes: [...new Set(pickCwes(cna))],
    references: (cna?.references ?? []).map((item) => item.url).filter(Boolean),
    sources: ['cveorg'],
  }
}

function yearQueries(days: number): string[] {
  const end = new Date()
  const start = daysAgo(days)
  const years = new Set<number>([start.getUTCFullYear(), end.getUTCFullYear()])
  return [...years].map((year) => `CVE-${year}`)
}

function inWindow(published: string | undefined, sinceIso: string): boolean {
  if (!published) return false
  return published >= sinceIso
}

function totalFrom(data: SearchResponse): number {
  return data.resultsTotal ?? data.total ?? 0
}

async function searchPage(
  query: string,
  from: number,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  const { data } = await postJson<SearchResponse>('/api/cveorg', {
    query,
    from,
    size: PAGE_SIZE,
    sort: { property: 'cveId', order: 'desc' },
  }, signal)
  return data
}

export async function fetchCveOrg(days: number, signal?: AbortSignal): Promise<PartialCve[]> {
  const sinceIso = daysAgo(days).toISOString()
  const out = new Map<string, PartialCve>()
  for (const query of yearQueries(days)) {
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const from = page * PAGE_SIZE
      const data = await searchPage(query, from, signal)
      const rows = (data.results ?? []).map(mapRecord).filter((row): row is PartialCve => Boolean(row))
      for (const row of rows) {
        if (!inWindow(row.published, sinceIso) && !inWindow(row.modified, sinceIso)) continue
        out.set(row.id, row)
      }
      const total = totalFrom(data)
      if (rows.length === 0 || from + PAGE_SIZE >= Math.min(total, MAX_WINDOW)) break
    }
  }
  return [...out.values()]
}
