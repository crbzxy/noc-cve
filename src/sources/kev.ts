import { getJson } from '../lib/http'
import type { KevInfo } from '../types'

// CISA Known Exploited Vulnerabilities — catálogo completo (~1.5k entradas, un solo JSON)
// https://www.cisa.gov/known-exploited-vulnerabilities-catalog

interface KevEntry {
  cveID: string
  vendorProject: string
  product: string
  vulnerabilityName: string
  dateAdded: string // YYYY-MM-DD
  shortDescription: string
  requiredAction: string
  dueDate: string
  knownRansomwareCampaignUse: 'Known' | 'Unknown'
  cwes?: string[]
}
interface KevResponse {
  catalogVersion: string
  dateReleased: string
  count: number
  vulnerabilities: KevEntry[]
}

export interface KevCatalog {
  version: string
  byId: Map<string, KevInfo & { description: string; cwes: string[] }>
}

export async function fetchKev(signal?: AbortSignal): Promise<KevCatalog> {
  const { data } = await getJson<KevResponse>('/api/kev', signal)
  const byId: KevCatalog['byId'] = new Map()
  for (const v of data.vulnerabilities) {
    byId.set(v.cveID, {
      dateAdded: v.dateAdded,
      dueDate: v.dueDate,
      requiredAction: v.requiredAction,
      ransomware: v.knownRansomwareCampaignUse === 'Known',
      vendor: v.vendorProject,
      product: v.product,
      name: v.vulnerabilityName,
      catalog: 'cisa',
      description: v.shortDescription,
      cwes: v.cwes ?? [],
    })
  }
  return { version: data.catalogVersion, byId }
}
