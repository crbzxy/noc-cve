import type { TechnologyConfig } from '../config/sources.schema'
import type { CveRecord } from '../types'

export interface TechGraphNode {
  id: string
  label: string
  count: number
  critical: number
  high: number
  kev: number
  /** 0..1 calor por criticidad relativa al máximo del grafo. */
  heat: number
  hub: boolean
}

export interface TechGraphEdge {
  source: string
  target: string
  weight: number
  kind: 'related' | 'shared'
  heat: number
}

export interface TechGraph {
  nodes: TechGraphNode[]
  edges: TechGraphEdge[]
}

interface TechStats {
  count: number
  critical: number
  high: number
  kev: number
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`
}

function emptyStats(): TechStats {
  return { count: 0, critical: 0, high: 0, kev: 0 }
}

function heatFromStats(stats: TechStats): number {
  return stats.critical * 4 + stats.high * 2 + stats.kev * 5 + stats.count * 0.15
}

/** Grafo de tecnologías: enlaces del JSON + coocurrencia, con calor por criticidad. */
export function buildTechGraph(
  rows: CveRecord[],
  technologies: TechnologyConfig[],
): TechGraph {
  const byId = new Map(technologies.map((tech) => [tech.id, tech]))
  const stats = new Map<string, TechStats>()
  const shared = new Map<string, { weight: number; heat: number }>()

  const bump = (id: string) => {
    const current = stats.get(id) ?? emptyStats()
    stats.set(id, current)
    return current
  }

  for (const row of rows) {
    const ids = [...new Set(row.technologies.filter((id) => byId.has(id)))]
    const rowHeat =
      (row.severity === 'CRITICAL' ? 4 : row.severity === 'HIGH' ? 2 : 0.5)
      + (row.kev ? 5 : 0)

    for (const id of ids) {
      const current = bump(id)
      current.count += 1
      if (row.severity === 'CRITICAL') current.critical += 1
      if (row.severity === 'HIGH') current.high += 1
      if (row.kev) current.kev += 1
    }

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = edgeKey(ids[i], ids[j])
        const edge = shared.get(key) ?? { weight: 0, heat: 0 }
        edge.weight += 1
        edge.heat += rowHeat
        shared.set(key, edge)
      }
    }
  }

  const related = new Map<string, number>()
  for (const tech of technologies) {
    for (const other of tech.related ?? []) {
      if (!byId.has(other)) continue
      const key = edgeKey(tech.id, other)
      if (!related.has(key)) related.set(key, 1)
    }
  }

  const activeIds = new Set<string>([
    ...stats.keys(),
    ...[...related.keys()].flatMap((key) => key.split('::')),
  ])

  if (activeIds.size === 0) {
    for (const tech of technologies) {
      if (tech.hub || (tech.related?.length ?? 0) > 0) activeIds.add(tech.id)
      for (const other of tech.related ?? []) activeIds.add(other)
    }
  }

  const rawScores = [...activeIds].map((id) => heatFromStats(stats.get(id) ?? emptyStats()))
  const maxScore = Math.max(1, ...rawScores)

  const nodes: TechGraphNode[] = [...activeIds]
    .filter((id) => byId.has(id))
    .map((id) => {
      const tech = byId.get(id)!
      const current = stats.get(id) ?? emptyStats()
      return {
        id,
        label: tech.label,
        count: current.count,
        critical: current.critical,
        high: current.high,
        kev: current.kev,
        heat: heatFromStats(current) / maxScore,
        hub: Boolean(tech.hub),
      }
    })
    .sort((a, b) => b.heat - a.heat || b.count - a.count || a.label.localeCompare(b.label))

  const nodeSet = new Set(nodes.map((n) => n.id))
  const maxEdgeHeat = Math.max(1, ...[...shared.values()].map((e) => e.heat))
  const edges: TechGraphEdge[] = []

  for (const [key, edge] of shared) {
    const [source, target] = key.split('::')
    if (!nodeSet.has(source) || !nodeSet.has(target)) continue
    edges.push({
      source,
      target,
      weight: edge.weight,
      kind: 'shared',
      heat: edge.heat / maxEdgeHeat,
    })
  }
  for (const [key] of related) {
    const [source, target] = key.split('::')
    if (!nodeSet.has(source) || !nodeSet.has(target)) continue
    if (shared.has(key)) continue
    edges.push({ source, target, weight: 1, kind: 'related', heat: 0 })
  }

  return { nodes, edges }
}
