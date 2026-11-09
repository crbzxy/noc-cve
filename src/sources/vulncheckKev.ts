import { getJson } from '../lib/http'
import type { KevInfo } from '../types'

// VulnCheck KEV (community) — catálogo ampliado de explotadas.
// https://api.vulncheck.com/v3/index/vulncheck-kev

interface VulncheckKevEntry {
  cve?: string[]
  vendorProject?: string
  product?: string
  vulnerabilityName?: string
  shortDescription?: string
  required_action?: string
  knownRansomwareCampaignUse?: string
  date_added?: string
  dueDate?: string
  cwes?: string[]
}

interface VulncheckResponse {
  data?: VulncheckKevEntry[]
  meta?: { next_cursor?: string | null }
}

export interface VulncheckKevCatalog {
  byId: Map<string, KevInfo & { description: string; cwes: string[] }>
}

const PAGE_LIMIT = 300
const MAX_PAGES = 40

function toDateOnly(raw?: string): string {
  if (!raw) return ''
  return raw.slice(0, 10)
}

export async function fetchVulncheckKev(signal?: AbortSignal): Promise<VulncheckKevCatalog> {
  const byId: VulncheckKevCatalog['byId'] = new Map()
  let cursor: string | undefined
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({ limit: String(PAGE_LIMIT) })
    if (cursor) params.set('cursor', cursor)
    else params.set('start_cursor', 'true')
    const { data } = await getJson<VulncheckResponse>(`/api/vckev?${params}`, signal)
    for (const entry of data.data ?? []) {
      const dateAdded = toDateOnly(entry.date_added)
      if (!dateAdded) continue
      for (const cveId of entry.cve ?? []) {
        if (!cveId.startsWith('CVE-')) continue
        byId.set(cveId, {
          dateAdded,
          dueDate: toDateOnly(entry.dueDate) || undefined,
          requiredAction: entry.required_action,
          ransomware: entry.knownRansomwareCampaignUse === 'Known',
          vendor: entry.vendorProject,
          product: entry.product,
          name: entry.vulnerabilityName,
          catalog: 'vulncheck',
          description: entry.shortDescription ?? '',
          cwes: entry.cwes ?? [],
        })
      }
    }
    const next = data.meta?.next_cursor
    if (!next) break
    cursor = next
  }
  return { byId }
}
