import type { WatchedPackage } from '../config/sources.schema'
import { packageKeyOf } from '../lib/resolveAppStack'
import { getJson, normalizeSeverity, postJson } from '../lib/http'
import type { PartialCve } from '../types'

// OSV.dev — consulta por paquete+versión (role: match), no listado temporal.
// Fase 1: querybatch (rápido). Fase 2: detalles acotados (lento, opcional).
// https://osv.dev/docs/#operation/OSV_QueryAffectedBatch

interface OsvSeverity {
  type?: string
  score?: string
}

interface OsvVulnSummary {
  id: string
  modified?: string
}

interface OsvVulnDetail {
  id: string
  summary?: string
  details?: string
  aliases?: string[]
  published?: string
  modified?: string
  severity?: OsvSeverity[]
  affected?: { package?: { ecosystem?: string; name?: string } }[]
  references?: { type?: string; url?: string }[]
  database_specific?: { severity?: string; cwe_ids?: string[] }
}

interface QueryBatchResponse {
  results?: { vulns?: OsvVulnSummary[] }[]
}

export interface OsvPackageHit {
  packageKey: string
  ecosystem: string
  name: string
  version?: string
  vulnIds: string[]
}

export interface OsvHitsResult {
  packageHits: OsvPackageHit[]
  summaries: OsvVulnSummary[]
}

export interface OsvMatchResult {
  records: PartialCve[]
  packageHits: OsvPackageHit[]
}

const BATCH_SIZE = 40
const DETAIL_CONCURRENCY = 6
/** Detalles extras a traer (solo los no presentes ya en NVD/GH). */
const MAX_DETAIL_FETCH = 80

const detailCache = new Map<string, PartialCve>()

function pickCvss(detail: OsvVulnDetail): { score?: number; version?: string; severity?: string } {
  const cvss = (detail.severity ?? []).find((item) => item.type?.startsWith('CVSS'))
  const numeric = Number(cvss?.score)
  const score = Number.isFinite(numeric) ? numeric : undefined
  const version = cvss?.type?.replace('CVSS_', '').replace('_', '.')
  return {
    score,
    version,
    severity: detail.database_specific?.severity,
  }
}

function primaryId(detail: OsvVulnDetail): { id: string; aliases: string[] } {
  const aliases = detail.aliases ?? []
  const cve = aliases.find((alias) => alias.startsWith('CVE-'))
  if (detail.id.startsWith('CVE-')) {
    return { id: detail.id, aliases: aliases.filter((alias) => alias !== detail.id) }
  }
  if (cve) {
    return { id: cve, aliases: [detail.id, ...aliases.filter((alias) => alias !== cve)] }
  }
  return { id: detail.id, aliases }
}

function mapDetail(detail: OsvVulnDetail): PartialCve {
  const { id, aliases } = primaryId(detail)
  const metric = pickCvss(detail)
  const packages = (detail.affected ?? [])
    .map((item) => item.package?.ecosystem && item.package.name
      ? `${item.package.ecosystem}:${item.package.name}`
      : undefined)
    .filter((value): value is string => Boolean(value))
  return {
    id,
    aliases: [...new Set(aliases)],
    title: detail.summary,
    description: detail.details ?? detail.summary ?? '',
    severity: normalizeSeverity(metric.severity),
    cvss: metric.score,
    cvssVersion: metric.version,
    published: detail.published,
    modified: detail.modified,
    packages: [...new Set(packages)],
    cwes: detail.database_specific?.cwe_ids ?? [],
    references: (detail.references ?? []).map((item) => item.url).filter((url): url is string => Boolean(url)),
    sources: ['osv'],
  }
}

function toQuery(pkg: WatchedPackage): Record<string, unknown> {
  const query: Record<string, unknown> = {
    package: { ecosystem: pkg.ecosystem, name: pkg.name },
  }
  if (pkg.version) query.version = pkg.version
  return query
}

/** Fase 1: solo querybatch — barato y suficiente para etiquetar GHSA ya cargados. */
export async function fetchOsvHits(
  packages: WatchedPackage[],
  signal?: AbortSignal,
): Promise<OsvHitsResult> {
  if (packages.length === 0) return { packageHits: [], summaries: [] }

  const packageHits: OsvPackageHit[] = []
  const summaries: OsvVulnSummary[] = []

  for (let index = 0; index < packages.length; index += BATCH_SIZE) {
    if (signal?.aborted) break
    const batch = packages.slice(index, index + BATCH_SIZE)
    const { data } = await postJson<QueryBatchResponse>('/api/osv/querybatch', {
      queries: batch.map(toQuery),
    }, signal)

    for (let resultIndex = 0; resultIndex < batch.length; resultIndex += 1) {
      const pkg = batch[resultIndex]
      const vulns = data.results?.[resultIndex]?.vulns ?? []
      summaries.push(...vulns)
      packageHits.push({
        packageKey: packageKeyOf(pkg.ecosystem, pkg.name, pkg.version),
        ecosystem: pkg.ecosystem,
        name: pkg.name,
        version: pkg.version,
        vulnIds: vulns.map((vuln) => vuln.id),
      })
    }
  }

  return { packageHits, summaries }
}

async function fetchDetails(ids: string[], signal?: AbortSignal): Promise<PartialCve[]> {
  const unique = [...new Set(ids)]
  const out: PartialCve[] = []
  const missing: string[] = []

  for (const id of unique) {
    const cached = detailCache.get(id)
    if (cached) out.push(cached)
    else missing.push(id)
  }

  for (let index = 0; index < missing.length; index += DETAIL_CONCURRENCY) {
    if (signal?.aborted) break
    const slice = missing.slice(index, index + DETAIL_CONCURRENCY)
    const rows = await Promise.all(slice.map(async (id) => {
      try {
        const { data } = await getJson<OsvVulnDetail>(`/api/osv/vulns/${encodeURIComponent(id)}`, signal)
        const mapped = mapDetail(data)
        detailCache.set(id, mapped)
        detailCache.set(mapped.id, mapped)
        return mapped
      } catch {
        return null
      }
    }))
    out.push(...rows.filter((row): row is PartialCve => Boolean(row)))
  }
  return out
}

/**
 * Elige IDs a detallar repartiendo por paquete (round-robin).
 * Evita quedarnos solo con vulns “recientes” y perder críticas históricas del inventario.
 */
function pickDetailIds(packageHits: OsvPackageHit[], knownIds: Set<string>): string[] {
  const selected: string[] = []
  const seen = new Set<string>()
  let round = 0
  while (selected.length < MAX_DETAIL_FETCH) {
    let addedInRound = false
    for (const hit of packageHits) {
      const vulnId = hit.vulnIds[round]
      if (!vulnId || knownIds.has(vulnId) || seen.has(vulnId)) continue
      seen.add(vulnId)
      selected.push(vulnId)
      addedInRound = true
      if (selected.length >= MAX_DETAIL_FETCH) break
    }
    if (!addedInRound) break
    round += 1
  }
  return selected
}

/**
 * Fase 2: trae detalles OSV que aún no estén en el corpus (por id/alias).
 * No bloquea el cruce inicial de la app.
 */
export async function fetchOsvDetails(
  packageHits: OsvPackageHit[],
  knownIds: Set<string>,
  signal?: AbortSignal,
): Promise<PartialCve[]> {
  const candidates = pickDetailIds(packageHits, knownIds)
  if (candidates.length === 0) return []
  return fetchDetails(candidates, signal)
}

/** Compat: hits + detalles en una sola llamada (preferir fases separadas en UI). */
export async function fetchOsvMatch(
  packages: WatchedPackage[],
  signal?: AbortSignal,
): Promise<OsvMatchResult> {
  const hits = await fetchOsvHits(packages, signal)
  const records = await fetchOsvDetails(hits.packageHits, new Set(), signal)
  const idAliasToCanonical = new Map<string, string>()
  for (const record of records) {
    idAliasToCanonical.set(record.id, record.id)
    for (const alias of record.aliases ?? []) idAliasToCanonical.set(alias, record.id)
  }
  return {
    records,
    packageHits: hits.packageHits.map((hit) => ({
      ...hit,
      vulnIds: [...new Set(hit.vulnIds.map((id) => idAliasToCanonical.get(id) ?? id))],
    })),
  }
}
