import { daysAgo, getJson, normalizeSeverity, sleep } from '../lib/http'
import type { PartialCve } from '../types'

// NVD API 2.0 — https://nvd.nist.gov/developers/vulnerabilities
// Rango máximo de pubStartDate/pubEndDate: 120 días. Máx 2000 resultados por página.

interface CvssMetric {
  cvssData: { baseScore: number; baseSeverity?: string; version: string }
  baseSeverity?: string // v2 lo trae aquí
  type?: 'Primary' | 'Secondary'
}
interface NvdCve {
  id: string
  published: string
  lastModified: string
  vulnStatus?: string
  descriptions: { lang: string; value: string }[]
  metrics?: {
    cvssMetricV40?: CvssMetric[]
    cvssMetricV31?: CvssMetric[]
    cvssMetricV30?: CvssMetric[]
    cvssMetricV2?: CvssMetric[]
  }
  weaknesses?: { description: { lang: string; value: string }[] }[]
  references?: { url: string }[]
}
interface NvdResponse {
  totalResults: number
  resultsPerPage: number
  startIndex: number
  vulnerabilities: { cve: NvdCve }[]
}

const PAGE = 2000
const MAX_PAGES = 5 // tope de seguridad: 10k CVEs
// NVD devuelve fechas sin offset (UTC): se normalizan para que Date no las lea como hora local
const asUtc = (d: string) => (/[zZ]|[+-]\d\d:\d\d$/.test(d) ? d : `${d}Z`)
const nvdDate = (d: Date) => d.toISOString().replace('Z', '') // sin offset = UTC

function pickMetric(m: NvdCve['metrics']): { score?: number; sev?: string; version?: string } {
  const lists = [m?.cvssMetricV40, m?.cvssMetricV31, m?.cvssMetricV30, m?.cvssMetricV2]
  for (const list of lists) {
    if (!list?.length) continue
    const best = list.find((x) => x.type === 'Primary') ?? list[0]
    return {
      score: best.cvssData.baseScore,
      sev: best.cvssData.baseSeverity ?? best.baseSeverity,
      version: best.cvssData.version,
    }
  }
  return {}
}

function mapNvd(cve: NvdCve): PartialCve {
  const metric = pickMetric(cve.metrics)
  const description =
    cve.descriptions.find((d) => d.lang === 'en')?.value ?? cve.descriptions[0]?.value ?? ''
  const cwes = (cve.weaknesses ?? [])
    .flatMap((w) => w.description.map((d) => d.value))
    .filter((v) => v.startsWith('CWE-'))
  return {
    id: cve.id,
    description,
    severity: normalizeSeverity(metric.sev),
    cvss: metric.score,
    cvssVersion: metric.version,
    published: asUtc(cve.published),
    modified: asUtc(cve.lastModified),
    status: cve.vulnStatus,
    cwes: [...new Set(cwes)],
    references: (cve.references ?? []).map((r) => r.url),
    sources: ['nvd'],
  }
}

export async function fetchNvd(days: number, signal?: AbortSignal): Promise<PartialCve[]> {
  const span = Math.min(days, 120)
  const base = new URLSearchParams({
    pubStartDate: nvdDate(daysAgo(span)),
    pubEndDate: nvdDate(new Date()),
    resultsPerPage: String(PAGE),
    noRejected: '',
  })
  const out: PartialCve[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    base.set('startIndex', String(page * PAGE))
    const qs = base.toString().replace('noRejected=', 'noRejected')
    const { data } = await getJson<NvdResponse>(`/api/nvd?${qs}`, signal)
    out.push(...data.vulnerabilities.map((v) => mapNvd(v.cve)))
    if (data.startIndex + data.resultsPerPage >= data.totalResults) break
    await sleep(6500, signal) // respeta 5 req / 30 s sin API key
  }
  return out
}
