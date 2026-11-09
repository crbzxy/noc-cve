import type { TechnologyConfig } from '../config/sources.schema'
import type { CveRecord } from '../types'

export const TOP_VULNERABLE_TECHS = 10

export interface TechRankItem {
  id: string
  label: string
  count: number
  critical: number
  high: number
  kev: number
}

interface TechStats {
  count: number
  critical: number
  high: number
  kev: number
}

function emptyStats(): TechStats {
  return { count: 0, critical: 0, high: 0, kev: 0 }
}

function sortByRisk(a: TechRankItem, b: TechRankItem): number {
  return b.critical - a.critical
    || b.high - a.high
    || b.kev - a.kev
    || b.count - a.count
    || a.label.localeCompare(b.label)
}

/** Top N tecnologías con CVEs, ordenadas por riesgo. Omite las que no tienen valor. */
export function buildTopVulnerableTechs(
  rows: CveRecord[],
  technologies: TechnologyConfig[],
  limit = TOP_VULNERABLE_TECHS,
): TechRankItem[] {
  const catalog = new Map(technologies.map((tech) => [tech.id, tech]))
  const stats = new Map<string, TechStats>()

  for (const row of rows) {
    for (const id of row.technologies) {
      if (!catalog.has(id)) continue
      const current = stats.get(id) ?? emptyStats()
      current.count += 1
      if (row.severity === 'CRITICAL') current.critical += 1
      if (row.severity === 'HIGH') current.high += 1
      if (row.kev) current.kev += 1
      stats.set(id, current)
    }
  }

  const items: TechRankItem[] = []
  for (const [id, current] of stats) {
    // Solo listar si hay valor visible en el ranking (críticas, altas o KEV)
    if (current.critical + current.high + current.kev === 0) continue
    const tech = catalog.get(id)
    if (!tech) continue
    items.push({
      id,
      label: tech.label,
      count: current.count,
      critical: current.critical,
      high: current.high,
      kev: current.kev,
    })
  }

  return items.sort(sortByRisk).slice(0, limit)
}
