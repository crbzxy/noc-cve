import type { TechnologyConfig } from '../config/sources.schema'
import { buildTechGraph, type TechGraphEdge, type TechGraphNode } from './techGraph'

export interface PlacedNode extends TechGraphNode {
  x: number
  y: number
  role: 'hub' | 'leaf'
  parentId?: string
}

export interface TechTopology {
  width: number
  height: number
  nodes: PlacedNode[]
  edges: TechGraphEdge[]
}

const WIDTH = 780
const HEIGHT = 360
const MAX_HUBS = 3
const MAX_LEAVES_PER_HUB = 7

function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return h
}

/** Topología legible tipo switch/hosts: pocos hubs y hojas en abanico. */
export function buildTechTopology(
  rows: Parameters<typeof buildTechGraph>[0],
  technologies: TechnologyConfig[],
): TechTopology {
  const graph = buildTechGraph(rows, technologies)
  if (graph.nodes.length === 0) {
    return { width: WIDTH, height: HEIGHT, nodes: [], edges: [] }
  }

  const weight = new Map<string, number>()
  for (const edge of graph.edges) {
    const score = edge.weight + (edge.kind === 'related' ? 0.5 : 0) + edge.heat * 2
    weight.set(`${edge.source}::${edge.target}`, score)
    weight.set(`${edge.target}::${edge.source}`, score)
  }

  const useHubs = graph.nodes
    .filter((n) => n.hub || n.count > 0)
    .sort((a, b) => (b.hub ? 10 : 0) + b.heat * 5 + b.count - ((a.hub ? 10 : 0) + a.heat * 5 + a.count))
    .slice(0, MAX_HUBS)

  if (useHubs.length === 0) {
    return { width: WIDTH, height: HEIGHT, nodes: [], edges: [] }
  }

  const hubIds = new Set(useHubs.map((h) => h.id))
  const clusters = new Map<string, TechGraphNode[]>(useHubs.map((h) => [h.id, []]))
  const leaves = graph.nodes
    .filter((n) => !hubIds.has(n.id))
    .sort((a, b) => b.heat - a.heat || b.count - a.count)

  for (const leaf of leaves) {
    let bestHub = useHubs[0].id
    let bestScore = -1
    for (const hub of useHubs) {
      const score = weight.get(`${leaf.id}::${hub.id}`) ?? 0
      if (score > bestScore) {
        bestScore = score
        bestHub = hub.id
      }
    }
    if (bestScore <= 0) bestHub = useHubs[Math.abs(hashId(leaf.id)) % useHubs.length].id
    const bucket = clusters.get(bestHub)!
    if (bucket.length >= MAX_LEAVES_PER_HUB) continue
    bucket.push(leaf)
  }

  const hubCenters =
    useHubs.length === 1
      ? [{ id: useHubs[0].id, x: WIDTH * 0.5, y: HEIGHT * 0.45 }]
      : useHubs.length === 2
        ? [
            { id: useHubs[0].id, x: WIDTH * 0.5, y: HEIGHT * 0.22 },
            { id: useHubs[1].id, x: WIDTH * 0.5, y: HEIGHT * 0.68 },
          ]
        : [
            { id: useHubs[0].id, x: WIDTH * 0.5, y: HEIGHT * 0.2 },
            { id: useHubs[1].id, x: WIDTH * 0.28, y: HEIGHT * 0.68 },
            { id: useHubs[2].id, x: WIDTH * 0.72, y: HEIGHT * 0.68 },
          ]

  const placed: PlacedNode[] = []
  const topologyEdges: TechGraphEdge[] = []
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))

  for (let i = 1; i < hubCenters.length; i++) {
    topologyEdges.push({
      source: hubCenters[0].id,
      target: hubCenters[i].id,
      weight: 2,
      kind: 'related',
      heat: Math.max(byId.get(hubCenters[0].id)?.heat ?? 0, byId.get(hubCenters[i].id)?.heat ?? 0),
    })
  }

  for (const center of hubCenters) {
    const hub = byId.get(center.id)!
    placed.push({ ...hub, role: 'hub', x: center.x, y: center.y })
    const cluster = clusters.get(center.id) ?? []
    const count = cluster.length
    const start = -Math.PI * 0.72
    const sweep = Math.PI * 1.44
    const radius = count <= 4 ? 86 : 102

    cluster.forEach((leaf, index) => {
      const t = count === 1 ? 0.5 : index / (count - 1)
      const angle = start + sweep * t
      placed.push({
        ...leaf,
        role: 'leaf',
        parentId: center.id,
        x: Math.min(WIDTH - 36, Math.max(36, center.x + Math.cos(angle) * radius)),
        y: Math.min(HEIGHT - 24, Math.max(24, center.y + Math.sin(angle) * radius)),
      })
      topologyEdges.push({
        source: center.id,
        target: leaf.id,
        weight: 1,
        kind: 'shared',
        heat: leaf.heat,
      })
    })
  }

  return { width: WIDTH, height: HEIGHT, nodes: placed, edges: topologyEdges }
}
