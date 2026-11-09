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

  for (const hit of packageHits) {
    const label = displayNameForPackage(libraries, hit.packageKey, hit.name)
    for (const vulnId of hit.vulnIds) add(vulnId, label)
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

/** Estado por librería del inventario de la app seleccionada. */
export function buildLibraryRiskRows(
  libraries: TrackedLibrary[],
  records: CveRecord[],
  packageHits: OsvPackageHit[],
): LibraryRiskRow[] {
  const recordsById = new Map(records.map((record) => [record.id, record]))
  const hitsByKey = new Map(packageHits.map((hit) => [hit.packageKey, hit]))

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

    const hit = library.watched ? hitsByKey.get(library.packageKey) : undefined
    const fromOsv = hit?.vulnIds ?? []
    const fromText = records
      .filter((record) => record.matchedLibraries.includes(library.displayName))
      .map((record) => record.id)
    const cveIds = [...new Set([...fromOsv, ...fromText])]
    const linked = cveIds
      .map((id) => recordsById.get(id))
      .filter((record): record is CveRecord => Boolean(record))

    if (!library.watched) {
      return {
        library,
        status: cveIds.length > 0 ? 'vulnerable' : 'unchecked',
        cveIds,
        maxSeverity: maxSeverityOf(linked),
        versionUnconfirmed: !library.version,
      }
    }

    return {
      library,
      status: cveIds.length > 0 ? 'vulnerable' : 'clean',
      cveIds,
      maxSeverity: maxSeverityOf(linked),
      versionUnconfirmed: !library.version,
    }
  })
}
