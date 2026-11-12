import type { KevCatalog } from '../sources/kev'
import type { VulncheckKevCatalog } from '../sources/vulncheckKev'
import type { CveRecord, EpssInfo, KevInfo, PartialCve, Severity, SourceId } from '../types'
import { daysAgo } from './http'

const SEV_RANK: Record<Severity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 }
const STACK_MATCH_BOOST = 150
const LIBRARY_MATCH_BOOST = 120
const uniq = <T,>(xs: T[]) => [...new Set(xs)]

function empty(id: string): CveRecord {
  return {
    id, aliases: [], description: '', severity: 'NONE', sources: [],
    packages: [], cwes: [], references: [], technologies: [], matchedLibraries: [],
  }
}

function isCanonical(sources: SourceId[]): boolean {
  return sources.includes('cveorg') || sources.includes('circl') || sources.includes('nvd')
}

function prefersIncomingScore(acc: CveRecord, partial: PartialCve): boolean {
  if (acc.cvss == null) return true
  if (partial.sources.includes('cveorg')) return true
  if (partial.sources.includes('circl') && !acc.sources.includes('cveorg')) return true
  if (
    partial.sources.includes('nvd')
    && !acc.sources.includes('cveorg')
    && !acc.sources.includes('circl')
  ) {
    return true
  }
  return false
}

/** Fusiona un parcial. CVE.org > NVD son canónicos de CVSS/descripción. */
function merge(acc: CveRecord, partial: PartialCve): CveRecord {
  const fromCanonicalSource = isCanonical(partial.sources)
  const useScore = prefersIncomingScore(acc, partial) && partial.cvss != null
  const useDescription = (fromCanonicalSource && partial.description)
    || (!acc.description && partial.description)
  return {
    ...acc,
    aliases: uniq([...acc.aliases, ...(partial.aliases ?? [])]),
    title: acc.title ?? partial.title,
    description: useDescription ? (partial.description ?? acc.description) : acc.description,
    severity:
      useScore && partial.severity && partial.severity !== 'NONE'
        ? partial.severity
        : acc.severity === 'NONE'
          ? (partial.severity ?? 'NONE')
          : acc.severity,
    cvss: useScore ? (partial.cvss ?? acc.cvss) : acc.cvss,
    cvssVersion: useScore ? (partial.cvssVersion ?? acc.cvssVersion) : acc.cvssVersion,
    published: [acc.published, partial.published].filter(Boolean).sort()[0],
    modified: [acc.modified, partial.modified].filter(Boolean).sort().at(-1),
    status: acc.status ?? partial.status,
    sources: uniq<SourceId>([...acc.sources, ...partial.sources]),
    packages: uniq([...acc.packages, ...(partial.packages ?? [])]),
    cwes: uniq([...acc.cwes, ...(partial.cwes ?? [])]),
    references: uniq([...acc.references, ...(partial.references ?? [])]),
    technologies: uniq([...acc.technologies, ...(partial.technologies ?? [])]),
    matchedLibraries: uniq([...acc.matchedLibraries, ...(partial.matchedLibraries ?? [])]),
  }
}

function applyKevCatalog(
  map: Map<string, CveRecord>,
  days: number,
  catalog: { byId: Map<string, KevInfo & { description: string; cwes: string[] }> },
  sourceId: SourceId,
): void {
  const since = daysAgo(days).toISOString().slice(0, 10)
  const add = (partial: PartialCve) => map.set(partial.id, merge(map.get(partial.id) ?? empty(partial.id), partial))
  for (const [id, entry] of catalog.byId) {
    if (entry.dateAdded < since) continue
    add({
      id,
      sources: [sourceId],
      description: entry.description,
      title: entry.name,
      cwes: entry.cwes,
      packages: entry.vendor && entry.product ? [`${entry.vendor}:${entry.product}`] : [],
      published: map.get(id)?.published ? undefined : `${entry.dateAdded}T00:00:00.000Z`,
    })
  }
  for (const record of map.values()) {
    const entry = catalog.byId.get(record.id)
    if (!entry) continue
    const { description: _description, cwes: _cwes, ...info } = entry
    if (!record.kev || info.catalog === 'cisa') record.kev = info
    if (!record.sources.includes(sourceId)) record.sources.push(sourceId)
  }
}

export interface AggregateInput {
  days: number
  lists?: PartialCve[][]
  kev?: KevCatalog
  vulncheckKev?: VulncheckKevCatalog
  epss?: Map<string, EpssInfo>
}

export function aggregate(input: AggregateInput): CveRecord[] {
  const map = new Map<string, CveRecord>()
  const add = (partial: PartialCve) => map.set(partial.id, merge(map.get(partial.id) ?? empty(partial.id), partial))

  for (const list of input.lists ?? []) list.forEach(add)

  // VulnCheck primero; CISA pisa el flag kev cuando ambos coinciden.
  if (input.vulncheckKev) applyKevCatalog(map, input.days, input.vulncheckKev, 'vulncheck-kev')
  if (input.kev) applyKevCatalog(map, input.days, input.kev, 'kev')

  if (input.epss) {
    for (const record of map.values()) record.epss = input.epss.get(record.id)
  }

  return [...map.values()]
}

/** Prioridad NOC: explotado > EPSS alto > stack vigilado > severidad > CVSS. */
export function riskScore(c: CveRecord): number {
  return (
    (c.kev ? 1000 : 0) +
    (c.kev?.ransomware ? 200 : 0) +
    (c.epss?.score ?? 0) * 500 +
    (c.technologies.length > 0 ? STACK_MATCH_BOOST : 0) +
    (c.matchedLibraries.length > 0 ? LIBRARY_MATCH_BOOST : 0) +
    SEV_RANK[c.severity] * 40 +
    (c.cvss ?? 0) * 2
  )
}
