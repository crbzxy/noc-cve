import { daysAgo, getJson, normalizeSeverity } from '../lib/http'
import type { PartialCve } from '../types'

// ENISA EUVD — respaldo europeo frente a retrasos de NVD.
// https://euvd.enisa.europa.eu/apidoc  → GET /api/search

interface EuvdProductLink {
  product?: { name?: string; vendor?: { name?: string } }
  product_version?: string
}

interface EuvdItem {
  id?: string
  description?: string
  datePublished?: string
  dateUpdated?: string
  baseScore?: number
  baseScoreVersion?: string
  references?: string
  aliases?: string
  assigner?: string
  epss?: number
  enisaIdProduct?: EuvdProductLink[]
}

interface EuvdSearchResponse {
  items?: EuvdItem[]
  total?: number
}

const PAGE_SIZE = 100
const MAX_PAGES = 10

function parseAliases(raw?: string): string[] {
  if (!raw) return []
  return raw.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean)
}

function parseReferences(raw?: string): string[] {
  if (!raw) return []
  return raw.split(/[\n]+/).map((item) => item.trim()).filter(Boolean)
}

function toIso(raw?: string): string | undefined {
  if (!raw) return undefined
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function severityFromScore(score?: number): string | undefined {
  if (score == null) return undefined
  if (score >= 9) return 'CRITICAL'
  if (score >= 7) return 'HIGH'
  if (score >= 4) return 'MEDIUM'
  if (score > 0) return 'LOW'
  return 'NONE'
}

function mapItem(item: EuvdItem): PartialCve | null {
  const aliases = parseAliases(item.aliases)
  const cveId = aliases.find((alias) => alias.startsWith('CVE-'))
  const id = cveId ?? item.id
  if (!id) return null
  const packages = (item.enisaIdProduct ?? [])
    .map((link) => {
      const vendor = link.product?.vendor?.name
      const product = link.product?.name
      if (vendor && product) return `${vendor}:${product}`
      return product
    })
    .filter((value): value is string => Boolean(value))
  return {
    id,
    aliases: [...new Set([item.id, ...aliases].filter((value): value is string => Boolean(value) && value !== id))],
    description: item.description ?? '',
    severity: normalizeSeverity(severityFromScore(item.baseScore)),
    cvss: item.baseScore,
    cvssVersion: item.baseScoreVersion,
    published: toIso(item.datePublished),
    modified: toIso(item.dateUpdated),
    packages: [...new Set(packages)],
    references: parseReferences(item.references),
    sources: ['euvd'],
  }
}

export async function fetchEuvd(days: number, signal?: AbortSignal): Promise<PartialCve[]> {
  const fromDate = daysAgo(days).toISOString().slice(0, 10)
  const out: PartialCve[] = []
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      fromDate,
      size: String(PAGE_SIZE),
      page: String(page),
    })
    const { data } = await getJson<EuvdSearchResponse>(`/api/euvd?${params}`, signal)
    const rows = (data.items ?? []).map(mapItem).filter((row): row is PartialCve => Boolean(row))
    out.push(...rows)
    const total = data.total ?? 0
    if ((page + 1) * PAGE_SIZE >= total || rows.length === 0) break
  }
  return out
}
