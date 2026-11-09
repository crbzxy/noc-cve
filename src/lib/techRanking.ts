import type { TechnologyConfig } from '../config/sources.schema'
import type { CveRecord } from '../types'

export type TechCategory = 'language' | 'framework'

export interface TechRankItem {
  id: string
  label: string
  category: TechCategory
  count: number
  critical: number
  high: number
  kev: number
}

export interface TechRanking {
  languages: TechRankItem[]
  frameworks: TechRankItem[]
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
  return b.critical - a.critical || b.high - a.high || b.kev - a.kev || b.count - a.count
    || a.label.localeCompare(b.label)
}

/** Ranking de lenguajes y frameworks según CVEs del stack. */
export function buildTechRanking(
  rows: CveRecord[],
  technologies: TechnologyConfig[],
): TechRanking {
  const catalog = technologies.filter(
    (tech): tech is TechnologyConfig & { category: TechCategory } =>
      tech.category === 'language' || tech.category === 'framework',
  )
  const stats = new Map<string, TechStats>()

  for (const row of rows) {
    for (const id of row.technologies) {
      const current = stats.get(id) ?? emptyStats()
      current.count += 1
      if (row.severity === 'CRITICAL') current.critical += 1
      if (row.severity === 'HIGH') current.high += 1
      if (row.kev) current.kev += 1
      stats.set(id, current)
    }
  }

  const items: TechRankItem[] = catalog.map((tech) => {
    const current = stats.get(tech.id) ?? emptyStats()
    return {
      id: tech.id,
      label: tech.label,
      category: tech.category,
      count: current.count,
      critical: current.critical,
      high: current.high,
      kev: current.kev,
    }
  })

  return {
    languages: items.filter((item) => item.category === 'language').sort(sortByRisk),
    frameworks: items.filter((item) => item.category === 'framework').sort(sortByRisk),
  }
}
