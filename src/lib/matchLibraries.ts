import type { OsvPackageHit } from '../sources/osv'
import type { CveRecord, Severity } from '../types'
import {
  librariesMatchingHaystack,
  type TrackedLibrary,
} from './resolveAppStack'

export type LibraryRiskStatus = 'vulnerable' | 'clean' | 'internal' | 'unchecked'

export interface LibraryRiskRow {
  library: TrackedLibrary
  status: LibraryRiskStatus
  cveIds: string[]
  maxSeverity: Severity | null
  /** true si el cruce OSV fue sin versión exacta del inventario. */
  versionUnconfirmed: boolean
}

function severityRank(severity: Severity): number {
  if (severity === 'CRITICAL') return 4
  if (severity === 'HIGH') return 3
  if (severity === 'MEDIUM') return 2
  if (severity === 'LOW') return 1
  return 0
}

function maxSeverityOf(records: CveRecord[]): Severity | null {
  if (records.length === 0) return null
  return records.reduce((best, record) => (
    severityRank(record.severity) > severityRank(best) ? record.severity : best
  ), records[0].severity)
}

function displayNameForPackage(libraries: TrackedLibrary[], packageKey: string, osvName: string): string {
  const byKey = libraries.find((library) => library.packageKey === packageKey)
  if (byKey) return byKey.displayName
  const artifact = osvName.includes(':') ? osvName.split(':').pop()! : osvName
  const byArtifact = libraries.find((library) => library.artifactId === artifact || library.watched?.name === osvName)
  return byArtifact?.displayName ?? artifact
}

/** Anexa matchedLibraries a cada CVE usando OSV + coincidencia textual del inventario. */
export function applyLibraryMatches(
  records: CveRecord[],
  libraries: TrackedLibrary[],
  packageHits: OsvPackageHit[],
): CveRecord[] {
  if (libraries.length === 0 && packageHits.length === 0) return records

  const libsByCve = new Map<string, Set<string>>()
  const add = (cveId: string, name: string) => {
    const set = libsByCve.get(cveId) ?? new Set<string>()
    set.add(name)
    libsByCve.set(cveId, set)
  }

  // OSV puede devolver GHSA; también etiquetamos por alias del registro.
  const aliasIndex = new Map<string, string>()
  for (const record of records) {
    aliasIndex.set(record.id, record.id)
    for (const alias of record.aliases) aliasIndex.set(alias, record.id)
  }

  for (const hit of packageHits) {
    const label = displayNameForPackage(libraries, hit.packageKey, hit.name)
    for (const vulnId of hit.vulnIds) {
      const canonical = aliasIndex.get(vulnId)
      if (canonical) add(canonical, label)
    }
  }

  return records.map((record) => {
    const fromOsv = libsByCve.get(record.id)
    const haystack = [
      record.id,
      record.title ?? '',
      record.description,
      record.packages.join(' '),
      record.aliases.join(' '),
    ].join('\n')
    const fromText = librariesMatchingHaystack(haystack, libraries)
    const matched = [...new Set([
      ...(record.matchedLibraries ?? []),
      ...(fromOsv ? [...fromOsv] : []),
      ...fromText,
    ])]
    return matched.length === 0 ? record : { ...record, matchedLibraries: matched }
  })
}

/**
 * Estado por librería usando SOLO los CVE ya visibles en el dashboard
 * (misma ventana/filtros que la tabla), no el total histórico de OSV.
 */
export function buildLibraryRiskRows(
  libraries: TrackedLibrary[],
  records: CveRecord[],
  packageHits: OsvPackageHit[] = [],
): LibraryRiskRow[] {
  const hitsByKey = new Map(packageHits.map((hit) => [hit.packageKey, hit]))
  const queriedKeys = new Set(
    packageHits.map((hit) => hit.packageKey),
  )

  return libraries.map((library) => {
    if (library.kind === 'internal') {
      return {
        library,
        status: 'internal',
        cveIds: [],
        maxSeverity: null,
        versionUnconfirmed: false,
      }
    }

    const linked = records.filter((record) => record.matchedLibraries.includes(library.displayName))
    const cveIds = linked.map((record) => record.id)
    const versionUnconfirmed = !library.version
    const wasQueried = library.watched ? queriedKeys.has(library.packageKey) || hitsByKey.has(library.packageKey) : false

    if (cveIds.length > 0) {
      return {
        library,
        status: 'vulnerable',
        cveIds,
        maxSeverity: maxSeverityOf(linked),
        versionUnconfirmed,
      }
    }

    if (!library.watched) {
      return {
        library,
        status: 'unchecked',
        cveIds: [],
        maxSeverity: null,
        versionUnconfirmed,
      }
    }

    return {
      library,
      status: wasQueried || Boolean(library.watched) ? 'clean' : 'unchecked',
      cveIds: [],
      maxSeverity: null,
      versionUnconfirmed,
    }
  })
}
