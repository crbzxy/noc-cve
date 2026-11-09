import type { WatchedPackage } from '../config/sources.schema'
import { packageKeyOf } from '../lib/resolveAppStack'
import { getJson, normalizeSeverity, postJson } from '../lib/http'
import type { PartialCve } from '../types'

// OSV.dev — consulta por paquete+versión (role: match), no listado temporal.
// Java/Maven: ecosystem "Maven", name "groupId:artifactId".
// npm/PyPI/Go cuando el inventario lo exponga.
// https://osv.dev/docs/#operation/OSV_QueryAffectedBatch

interface OsvPackage {
  ecosystem?: string
  name?: string
}

interface OsvAffected {
  package?: OsvPackage
}

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
  affected?: OsvAffected[]
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

export interface OsvMatchResult {
  records: PartialCve[]
  packageHits: OsvPackageHit[]
}

const BATCH_SIZE = 40
const DETAIL_CONCURRENCY = 8

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

async function fetchDetails(ids: string[], signal?: AbortSignal): Promise<PartialCve[]> {
  const unique = [...new Set(ids)]
  const out: PartialCve[] = []
  for (let index = 0; index < unique.length; index += DETAIL_CONCURRENCY) {
    const slice = unique.slice(index, index + DETAIL_CONCURRENCY)
    const rows = await Promise.all(slice.map(async (id) => {
      try {
        const { data } = await getJson<OsvVulnDetail>(`/api/osv/vulns/${encodeURIComponent(id)}`, signal)
        return mapDetail(data)
      } catch {
        return null
      }
    }))
    out.push(...rows.filter((row): row is PartialCve => Boolean(row)))
  }
  return out
}

function toQuery(pkg: WatchedPackage): Record<string, unknown> {
  const query: Record<string, unknown> = {
    package: { ecosystem: pkg.ecosystem, name: pkg.name },
  }
  if (pkg.version) query.version = pkg.version
  return query
}

/**
 * Cruza watchedPackages con OSV querybatch y conserva el vínculo paquete → vuln.
 * Sin inventario configurado no consulta (rol match, no listado).
 */
export async function fetchOsvMatch(
  packages: WatchedPackage[],
  signal?: AbortSignal,
): Promise<OsvMatchResult> {
  if (packages.length === 0) return { records: [], packageHits: [] }

  const packageHits: OsvPackageHit[] = []
  const vulnIds = new Set<string>()
  const idAliasToCanonical = new Map<string, string>()

  for (let index = 0; index < packages.length; index += BATCH_SIZE) {
    const batch = packages.slice(index, index + BATCH_SIZE)
    const { data } = await postJson<QueryBatchResponse>('/api/osv/querybatch', {
      queries: batch.map(toQuery),
    }, signal)

    for (let resultIndex = 0; resultIndex < batch.length; resultIndex += 1) {
      const pkg = batch[resultIndex]
      const vulns = data.results?.[resultIndex]?.vulns ?? []
      const ids = vulns.map((vuln) => vuln.id)
      for (const id of ids) vulnIds.add(id)
      packageHits.push({
        packageKey: packageKeyOf(pkg.ecosystem, pkg.name, pkg.version),
        ecosystem: pkg.ecosystem,
        name: pkg.name,
        version: pkg.version,
        vulnIds: ids,
      })
    }
  }

  const records = await fetchDetails([...vulnIds], signal)
  for (const record of records) {
    idAliasToCanonical.set(record.id, record.id)
    for (const alias of record.aliases ?? []) idAliasToCanonical.set(alias, record.id)
  }

  const resolvedHits = packageHits.map((hit) => ({
    ...hit,
    vulnIds: [...new Set(hit.vulnIds.map((id) => idAliasToCanonical.get(id) ?? id))],
  }))

  return { records, packageHits: resolvedHits }
}
