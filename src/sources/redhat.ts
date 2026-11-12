import { daysAgo, getJson, normalizeSeverity } from '../lib/http'
import type { PartialCve } from '../types'

// Red Hat Security Data API — catálogo oficial de CVEs.
// https://access.redhat.com/documentation/en-us/red_hat_security_data_api/

interface RedHatCve {
  CVE?: string
  severity?: string
  public_date?: string
  bugzilla_description?: string
  cvss3_score?: string | number
  cvss_score?: string | number
  cvss3_scoring_vector?: string
  cvss_scoring_vector?: string
  CWE?: string
  affected_packages?: string[]
  resource_url?: string
}

const PAGE_SIZE = 1000
const MAX_PAGES = 10

function toNumber(value: string | number | undefined): number | undefined {
  if (value == null || value === '') return undefined
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : undefined
}

function mapSeverity(raw?: string): string | undefined {
  if (!raw) return undefined
  const key = raw.toLowerCase()
  if (key === 'critical') return 'CRITICAL'
  if (key === 'important') return 'HIGH'
  if (key === 'moderate') return 'MEDIUM'
  if (key === 'low') return 'LOW'
  return raw.toUpperCase()
}

function vectorVersion(vector?: string): string | undefined {
  const match = vector?.match(/^CVSS:(\d+(?:\.\d+)?)/i)
  return match?.[1]
}

function mapItem(item: RedHatCve): PartialCve | null {
  const id = item.CVE
  if (!id?.startsWith('CVE-')) return null
  const cvss = toNumber(item.cvss3_score) ?? toNumber(item.cvss_score)
  const cvssVersion = vectorVersion(item.cvss3_scoring_vector)
    ?? vectorVersion(item.cvss_scoring_vector)
    ?? (item.cvss3_score != null ? '3.1' : undefined)
  const cwes = item.CWE
    ? item.CWE.split(/[\s,]+/).map((value) => value.trim()).filter((value) => value.startsWith('CWE-'))
    : []
  return {
    id,
    description: item.bugzilla_description ?? '',
    severity: normalizeSeverity(mapSeverity(item.severity)),
    cvss,
    cvssVersion,
    published: item.public_date,
    packages: [...new Set(item.affected_packages ?? [])],
    cwes: [...new Set(cwes)],
    references: item.resource_url ? [item.resource_url] : [],
    sources: ['redhat'],
  }
}

export async function fetchRedHat(days: number, signal?: AbortSignal): Promise<PartialCve[]> {
  const after = daysAgo(days).toISOString().slice(0, 10)
  const out: PartialCve[] = []

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      after,
      per_page: String(PAGE_SIZE),
      page: String(page),
    })
    const { data } = await getJson<RedHatCve[]>(`/api/redhat?${params}`, signal)
    const rows = (Array.isArray(data) ? data : []).map(mapItem).filter((row): row is PartialCve => Boolean(row))
    out.push(...rows)
    if (rows.length < PAGE_SIZE) break
  }

  return out
}
