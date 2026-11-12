import { daysAgo, getJson, normalizeSeverity } from '../lib/http'
import type { PartialCve } from '../types'

// Microsoft MSRC CVRF API v3 — updates + documento mensual.
// https://api.msrc.microsoft.com/cvrf/v3.0

interface MsrcUpdate {
  ID?: string
  DocumentTitle?: string
  InitialReleaseDate?: string
  CurrentReleaseDate?: string
  CvrfUrl?: string
}

interface MsrcUpdatesResponse {
  value?: MsrcUpdate[]
}

interface MsrcNote {
  Title?: string
  Type?: number
  Value?: string
}

interface MsrcThreat {
  Type?: number
  Description?: { Value?: string }
}

interface MsrcScoreSet {
  BaseScore?: number
  Vector?: string
}

interface MsrcVulnerability {
  CVE?: string
  Title?: { Value?: string }
  Notes?: MsrcNote[]
  Threats?: MsrcThreat[]
  CWE?: { ID?: string }[]
  CVSSScoreSets?: MsrcScoreSet[]
  Remediations?: { URL?: string }[]
  RevisionHistory?: { Date?: string }[]
}

interface MsrcCvrfDocument {
  Vulnerability?: MsrcVulnerability[]
  ProductTree?: { FullProductName?: { ProductID?: string; Value?: string }[] }
}

const MAX_UPDATES = 4

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function mapMsSeverity(raw?: string): string | undefined {
  if (!raw) return undefined
  const key = raw.toLowerCase()
  if (key === 'critical') return 'CRITICAL'
  if (key === 'important') return 'HIGH'
  if (key === 'moderate') return 'MEDIUM'
  if (key === 'low') return 'LOW'
  return raw.toUpperCase()
}

function pickDescription(notes?: MsrcNote[]): string {
  const description = notes?.find((note) => note.Type === 2 || note.Title === 'Description')
  return description?.Value ? stripHtml(description.Value) : ''
}

function pickSeverity(threats?: MsrcThreat[]): string | undefined {
  const threat = threats?.find((item) => item.Type === 3 && item.Description?.Value)
  return mapMsSeverity(threat?.Description?.Value)
}

function pickPublished(vuln: MsrcVulnerability): string | undefined {
  const dates = (vuln.RevisionHistory ?? [])
    .map((row) => row.Date)
    .filter((value): value is string => Boolean(value && !value.startsWith('0001')))
  return dates.sort()[0]
}

function mapVulnerability(vuln: MsrcVulnerability): PartialCve | null {
  const id = vuln.CVE
  if (!id?.startsWith('CVE-')) return null
  const score = vuln.CVSSScoreSets?.[0]
  const version = score?.Vector?.match(/^CVSS:(\d+(?:\.\d+)?)/i)?.[1]
  const products = (vuln.Notes ?? [])
    .filter((note) => note.Type === 7 && note.Value)
    .map((note) => `microsoft:${note.Value!.trim()}`)
  return {
    id,
    title: vuln.Title?.Value,
    description: pickDescription(vuln.Notes),
    severity: normalizeSeverity(pickSeverity(vuln.Threats)),
    cvss: score?.BaseScore,
    cvssVersion: version,
    published: pickPublished(vuln),
    packages: [...new Set(products)],
    cwes: [...new Set((vuln.CWE ?? []).map((row) => row.ID).filter((cwe): cwe is string => Boolean(cwe?.startsWith('CWE-'))))],
    references: [...new Set((vuln.Remediations ?? []).map((row) => row.URL).filter((url): url is string => Boolean(url)))],
    sources: ['msrc'],
  }
}

function updatesInWindow(updates: MsrcUpdate[], days: number): MsrcUpdate[] {
  const since = daysAgo(days).getTime()
  return updates
    .filter((update) => {
      if (!update.ID || !update.InitialReleaseDate) return false
      const stamp = Date.parse(update.InitialReleaseDate)
      return Number.isFinite(stamp) && stamp >= since
    })
    .sort((left, right) =>
      String(right.InitialReleaseDate).localeCompare(String(left.InitialReleaseDate)))
    .slice(0, MAX_UPDATES)
}

export async function fetchMsrc(days: number, signal?: AbortSignal): Promise<PartialCve[]> {
  const { data } = await getJson<MsrcUpdatesResponse>('/api/msrc/updates', signal)
  const selected = updatesInWindow(data.value ?? [], days)
  const out: PartialCve[] = []

  for (const update of selected) {
    const { data: document } = await getJson<MsrcCvrfDocument>(
      `/api/msrc/cvrf/${encodeURIComponent(update.ID!)}`,
      signal,
    )
    for (const vuln of document.Vulnerability ?? []) {
      const mapped = mapVulnerability(vuln)
      if (mapped) out.push(mapped)
    }
  }

  return out
}
