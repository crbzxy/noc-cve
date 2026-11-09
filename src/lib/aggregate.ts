import type { KevCatalog } from '../sources/kev'
import type { CveRecord, EpssInfo, PartialCve, Severity, SourceId } from '../types'
import { daysAgo } from './http'

const SEV_RANK: Record<Severity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 }
const STACK_MATCH_BOOST = 150
const uniq = <T,>(xs: T[]) => [...new Set(xs)]

function empty(id: string): CveRecord {
  return {
    id, aliases: [], description: '', severity: 'NONE', sources: [],
    packages: [], cwes: [], references: [], technologies: [],
  }
}

/** Fusiona un parcial sobre el acumulado. NVD es la fuente canónica de CVSS; GitHub completa huecos. */
function merge(acc: CveRecord, p: PartialCve): CveRecord {
  const fromNvd = p.sources.includes('nvd')
  const useScore = acc.cvss == null || (fromNvd && p.cvss != null)
  return {
    ...acc,
    aliases: uniq([...acc.aliases, ...(p.aliases ?? [])]),
    title: acc.title ?? p.title,
    description: (fromNvd && p.description) || acc.description || p.description || '',
    severity:
      useScore && p.severity && p.severity !== 'NONE'
        ? p.severity
        : acc.severity === 'NONE'
          ? (p.severity ?? 'NONE')
          : acc.severity,
    cvss: useScore ? (p.cvss ?? acc.cvss) : acc.cvss,
    cvssVersion: useScore ? (p.cvssVersion ?? acc.cvssVersion) : acc.cvssVersion,
    published: [acc.published, p.published].filter(Boolean).sort()[0],
    modified: [acc.modified, p.modified].filter(Boolean).sort().at(-1),
    status: acc.status ?? p.status,
    sources: uniq<SourceId>([...acc.sources, ...p.sources]),
    packages: uniq([...acc.packages, ...(p.packages ?? [])]),
    cwes: uniq([...acc.cwes, ...(p.cwes ?? [])]),
    references: uniq([...acc.references, ...(p.references ?? [])]),
    technologies: uniq([...acc.technologies, ...(p.technologies ?? [])]),
  }
}

export function aggregate(
  days: number,
  nvd: PartialCve[] = [],
  github: PartialCve[] = [],
  kev?: KevCatalog,
  epss?: Map<string, EpssInfo>,
): CveRecord[] {
  const map = new Map<string, CveRecord>()
  const add = (p: PartialCve) => map.set(p.id, merge(map.get(p.id) ?? empty(p.id), p))

  nvd.forEach(add)
  github.forEach(add)

  // KEV: entradas añadidas dentro de la ventana entran a la lista (aunque el CVE sea viejo)
  // y todo CVE ya listado que esté en el catálogo se marca como explotado.
  if (kev) {
    const since = daysAgo(days).toISOString().slice(0, 10)
    for (const [id, k] of kev.byId) {
      if (k.dateAdded < since) continue
      add({
        id, sources: ['kev'], description: k.description, title: k.name,
        cwes: k.cwes, packages: [`${k.vendor}:${k.product}`],
        // dateAdded solo como fecha de referencia si ninguna otra fuente trae publicación
        published: map.get(id)?.published ? undefined : `${k.dateAdded}T00:00:00.000Z`,
      })
    }
    for (const rec of map.values()) {
      const k = kev.byId.get(rec.id)
      if (!k) continue
      const { description: _d, cwes: _c, ...info } = k
      rec.kev = info
      if (!rec.sources.includes('kev')) rec.sources.push('kev')
    }
  }

  if (epss) for (const rec of map.values()) rec.epss = epss.get(rec.id)

  return [...map.values()]
}

/** Prioridad NOC: explotado > EPSS alto > stack vigilado > severidad > CVSS. */
export function riskScore(c: CveRecord): number {
  return (
    (c.kev ? 1000 : 0) +
    (c.kev?.ransomware ? 200 : 0) +
    (c.epss?.score ?? 0) * 500 +
    (c.technologies.length > 0 ? STACK_MATCH_BOOST : 0) +
    SEV_RANK[c.severity] * 40 +
    (c.cvss ?? 0) * 2
  )
}
