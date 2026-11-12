import { daysAgo, getJson, normalizeSeverity } from '../lib/http'
import type { PartialCve } from '../types'

// CIRCL Vulnerability-Lookup (CERT.LU) — API pública oficial.
// https://vulnerability.circl.lu/documentation/api.html
// Fuente cvelistv5 = registros CVE List 5.x (mismo programa MITRE/CVE.org).

interface CirclMetric {
  cvssV4_0?: { baseScore?: number; baseSeverity?: string; version?: string }
  cvssV3_1?: { baseScore?: number; baseSeverity?: string; version?: string }
  cvssV3_0?: { baseScore?: number; baseSeverity?: string; version?: string }
  cvssV2_0?: { baseScore?: number; baseSeverity?: string; version?: string }
}

interface CirclContainer {
  descriptions?: { lang: string; value: string }[]
  affected?: { vendor?: string; product?: string }[]
  problemTypes?: { descriptions?: { cweId?: string }[] }[]
  references?: { url: string }[]
  metrics?: CirclMetric[]
  title?: string
}

interface CirclCveRecord {
  dataType?: string
  cveMetadata?: {
    cveId?: string
    state?: string
    datePublished?: string
    dateUpdated?: string
  }
  containers?: {
    cna?: CirclContainer
  }
}

interface CirclOsvLike {
  id?: string
  aliases?: string[]
  details?: string
  published?: string
  modified?: string
  severity?: { type?: string; score?: string }[]
  affected?: { package?: { ecosystem?: string; name?: string } }[]
  references?: { url?: string }[]
}

type CirclItem = CirclCveRecord | CirclOsvLike

const PAGE_SIZE = 100
const MAX_PAGES = 20

function pickMetric(container?: CirclContainer): { score?: number; sev?: string; version?: string } {
  const metrics = container?.metrics ?? []
  for (const metric of metrics) {
    const data = metric.cvssV4_0 ?? metric.cvssV3_1 ?? metric.cvssV3_0 ?? metric.cvssV2_0
    if (data?.baseScore == null) continue
    return {
      score: data.baseScore,
      sev: data.baseSeverity,
      version: data.version ?? (metric.cvssV4_0 ? '4.0' : metric.cvssV3_1 ? '3.1' : undefined),
    }
  }
  return {}
}

function pickDescription(container?: CirclContainer): string {
  const list = container?.descriptions ?? []
  return list.find((item) => item.lang?.startsWith('en'))?.value ?? list[0]?.value ?? ''
}

function pickCwes(container?: CirclContainer): string[] {
  return (container?.problemTypes ?? [])
    .flatMap((problem) => problem.descriptions ?? [])
    .map((item) => item.cweId)
    .filter((id): id is string => Boolean(id?.startsWith('CWE-')))
}

function mapOsvSeverity(rows?: CirclOsvLike['severity']): { score?: number; version?: string } {
  for (const row of rows ?? []) {
    if (!row.score) continue
    const numeric = Number(row.score)
    if (Number.isFinite(numeric)) return { score: numeric }
    const version = row.score.match(/^CVSS:(\d+(?:\.\d+)?)/i)?.[1]
    if (version) return { version }
  }
  return {}
}

function severityFromScore(score?: number): string | undefined {
  if (score == null) return undefined
  if (score >= 9) return 'CRITICAL'
  if (score >= 7) return 'HIGH'
  if (score >= 4) return 'MEDIUM'
  if (score > 0) return 'LOW'
  return 'NONE'
}

function mapCveRecord(record: CirclCveRecord): PartialCve | null {
  const id = record.cveMetadata?.cveId
  if (!id?.startsWith('CVE-')) return null
  const cna = record.containers?.cna
  const metric = pickMetric(cna)
  const packages = (cna?.affected ?? [])
    .map((item) => (item.vendor && item.product ? `${item.vendor}:${item.product}` : item.product))
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
    sources: ['circl'],
  }
}

function mapOsvLike(item: CirclOsvLike): PartialCve | null {
  const aliases = item.aliases ?? []
  const cveId = [item.id, ...aliases].find((value) => value?.startsWith('CVE-'))
  if (!cveId) return null
  const metric = mapOsvSeverity(item.severity)
  const packages = (item.affected ?? [])
    .map((row) => {
      const ecosystem = row.package?.ecosystem
      const name = row.package?.name
      if (ecosystem && name) return `${ecosystem}:${name}`
      return name
    })
    .filter((value): value is string => Boolean(value))
  return {
    id: cveId,
    aliases: [...new Set([item.id, ...aliases].filter((value): value is string => Boolean(value) && value !== cveId))],
    description: item.details ?? '',
    severity: normalizeSeverity(severityFromScore(metric.score)),
    cvss: metric.score,
    cvssVersion: metric.version,
    published: item.published,
    modified: item.modified,
    packages: [...new Set(packages)],
    references: (item.references ?? []).map((row) => row.url).filter((url): url is string => Boolean(url)),
    sources: ['circl'],
  }
}

function isCveRecord(item: CirclItem): item is CirclCveRecord {
  return 'cveMetadata' in item
    || ('dataType' in item && (item as CirclCveRecord).dataType === 'CVE_RECORD')
}

function mapItem(item: CirclItem): PartialCve | null {
  if (isCveRecord(item)) return mapCveRecord(item)
  return mapOsvLike(item)
}

function inWindow(iso: string | undefined, sinceIso: string): boolean {
  if (!iso) return false
  return iso >= sinceIso
}

export async function fetchCircl(days: number, signal?: AbortSignal): Promise<PartialCve[]> {
  const sinceIso = daysAgo(days).toISOString()
  const sinceDate = sinceIso.slice(0, 10)
  const out = new Map<string, PartialCve>()

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      source: 'cvelistv5',
      per_page: String(PAGE_SIZE),
      page: String(page),
      date_sort: 'updated',
      sort_order: 'desc',
      since: sinceDate,
    })
    const { data } = await getJson<CirclItem[]>(`/api/circl/vulnerability/?${params}`, signal)
    const rows = (Array.isArray(data) ? data : []).map(mapItem).filter((row): row is PartialCve => Boolean(row))
    if (rows.length === 0) break

    let olderThanWindow = 0
    for (const row of rows) {
      if (!inWindow(row.published, sinceIso) && !inWindow(row.modified, sinceIso)) {
        olderThanWindow += 1
        continue
      }
      out.set(row.id, row)
    }
    if (rows.length < PAGE_SIZE || olderThanWindow === rows.length) break
  }

  return [...out.values()]
}
