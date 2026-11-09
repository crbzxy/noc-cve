import { daysAgo, getJson, normalizeSeverity } from '../lib/http'
import type { PartialCve } from '../types'

// Wordfence Intelligence v3 — plugins/temas WP que casi no llegan a NVD.
// https://www.wordfence.com/api/intelligence/v3/vulnerabilities/production

interface WordfenceSoftware {
  type?: string
  name?: string
  slug?: string
}

interface WordfenceCvss {
  score?: number
  rating?: string
  vector?: string
}

interface WordfenceCwe {
  id?: string
  name?: string
}

interface WordfenceEntry {
  id?: string
  title?: string
  description?: string
  published?: string
  published_date?: string
  cve?: string | string[] | null
  references?: string[]
  software?: WordfenceSoftware[]
  cvss?: WordfenceCvss | null
  cwe?: WordfenceCwe | null
  informational?: boolean
}

type WordfenceFeed = Record<string, WordfenceEntry>

function asCveList(raw: WordfenceEntry['cve']): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter((id) => id.startsWith('CVE-'))
  return raw.startsWith('CVE-') ? [raw] : []
}

function mapEntry(entry: WordfenceEntry, uuid: string): PartialCve | null {
  if (entry.informational) return null
  const cves = asCveList(entry.cve)
  const id = cves[0] ?? (entry.id ? `WF-${entry.id}` : `WF-${uuid}`)
  const published = entry.published ?? entry.published_date
  const packages = (entry.software ?? [])
    .map((item) => {
      const name = item.slug ?? item.name
      if (!name) return undefined
      const kind = item.type ?? 'wordpress'
      return `wordpress:${kind}:${name}`
    })
    .filter((value): value is string => Boolean(value))
  return {
    id,
    aliases: [...new Set([entry.id, uuid, ...cves].filter((value): value is string => Boolean(value) && value !== id))],
    title: entry.title,
    description: entry.description ?? entry.title ?? '',
    severity: normalizeSeverity(entry.cvss?.rating),
    cvss: entry.cvss?.score,
    cvssVersion: entry.cvss?.vector?.startsWith('CVSS:4') ? '4.0' : entry.cvss?.vector?.startsWith('CVSS:3') ? '3.x' : undefined,
    published,
    packages: [...new Set(packages)],
    cwes: entry.cwe?.id?.startsWith('CWE-') ? [entry.cwe.id] : [],
    references: entry.references ?? [],
    sources: ['wordfence'],
  }
}

export async function fetchWordfence(days: number, signal?: AbortSignal): Promise<PartialCve[]> {
  const since = daysAgo(days).toISOString()
  const { data } = await getJson<WordfenceFeed>('/api/wordfence', signal)
  const out: PartialCve[] = []
  for (const [uuid, entry] of Object.entries(data ?? {})) {
    const mapped = mapEntry(entry, uuid)
    if (!mapped) continue
    if (mapped.published && mapped.published < since) continue
    out.push(mapped)
  }
  return out
}
