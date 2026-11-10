import type { OsvPackageHit } from '../sources/osv'
import type { CveRecord, Severity } from '../types'
import {
  textNeedlesFromLibrary,
  type TrackedLibrary,
} from './resolveAppStack'

export type LibraryRiskStatus = 'vulnerable' | 'clean' | 'internal' | 'unchecked'

export interface LibraryRiskRow {
  library: TrackedLibrary
  status: LibraryRiskStatus
  cveIds: string[]
  maxSeverity: Severity | null
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

function sameNames(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

/**
 * Cruce rápido: OSV hits primero; texto solo para libs no consultadas en OSV.
 * Solo clona registros cuyo matchedLibraries cambie.
 */
export function applyLibraryMatches(
  records: CveRecord[],
  libraries: TrackedLibrary[],
  packageHits: OsvPackageHit[],
): CveRecord[] {
  if (libraries.length === 0 && packageHits.length === 0) {
    if (records.every((record) => record.matchedLibraries.length === 0)) return records
    return records.map((record) => (
      record.matchedLibraries.length === 0 ? record : { ...record, matchedLibraries: [] }
    ))
  }

  const libsByCve = new Map<string, Set<string>>()
  const add = (cveId: string, name: string) => {
    const set = libsByCve.get(cveId) ?? new Set<string>()
    set.add(name)
    libsByCve.set(cveId, set)
  }

  const aliasIndex = new Map<string, string>()
  for (const record of records) {
    aliasIndex.set(record.id, record.id)
    for (const alias of record.aliases) aliasIndex.set(alias, record.id)
  }

  const queriedKeys = new Set(packageHits.map((hit) => hit.packageKey))
  for (const hit of packageHits) {
    const label = displayNameForPackage(libraries, hit.packageKey, hit.name)
    for (const vulnId of hit.vulnIds) {
      const canonical = aliasIndex.get(vulnId)
      if (canonical) add(canonical, label)
    }
  }

  // Texto: libs sin OSV, o Packagist consultado pero sin hits (versión exacta suele salir vacía).
  const textLibraries = libraries.filter((library) => {
    if (!library.watched) return true
    if (!queriedKeys.has(library.packageKey)) return true
    const hit = packageHits.find((item) => item.packageKey === library.packageKey)
    return (library.ecosystem === 'Packagist' || library.ecosystem === 'WordPress')
      && (hit?.vulnIds.length ?? 0) === 0
  })
  const textNeedles = textLibraries.flatMap((library) =>
    textNeedlesFromLibrary(library).map((needle) => ({ library, needle })),
  )

  if (textNeedles.length > 0) {
    for (const record of records) {
      const quick = [
        record.id,
        record.title ?? '',
        record.description.slice(0, 480),
        record.packages.join(' '),
        record.aliases.join(' '),
      ].join('\n').toLowerCase()

      for (const item of textNeedles) {
        if (quick.includes(item.needle)) add(record.id, item.library.displayName)
      }
    }
  }

  if (libsByCve.size === 0) {
    if (records.every((record) => record.matchedLibraries.length === 0)) return records
    return records.map((record) => (
      record.matchedLibraries.length === 0 ? record : { ...record, matchedLibraries: [] }
    ))
  }

  return records.map((record) => {
    const matched = libsByCve.get(record.id)
    if (!matched) {
      return record.matchedLibraries.length === 0 ? record : { ...record, matchedLibraries: [] }
    }
    const next = [...matched].sort()
    if (sameNames(record.matchedLibraries, next)) return record
    return { ...record, matchedLibraries: next }
  })
}

export function buildLibraryRiskRows(
  libraries: TrackedLibrary[],
  records: CveRecord[],
  packageHits: OsvPackageHit[] = [],
): LibraryRiskRow[] {
  const hitsByKey = new Map(packageHits.map((hit) => [hit.packageKey, hit]))
  const queriedKeys = new Set(packageHits.map((hit) => hit.packageKey))
  const recordsByLibrary = new Map<string, CveRecord[]>()

  for (const record of records) {
    for (const name of record.matchedLibraries) {
      const list = recordsByLibrary.get(name)
      if (list) list.push(record)
      else recordsByLibrary.set(name, [record])
    }
  }

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

    const linked = recordsByLibrary.get(library.displayName) ?? []
    const cveIds = linked.map((record) => record.id)
    const versionUnconfirmed = !library.version
    const osvHit = library.watched ? hitsByKey.get(library.packageKey) : undefined
    const wasQueried = library.watched
      ? queriedKeys.has(library.packageKey) || Boolean(osvHit)
      : false

    if (cveIds.length > 0) {
      return {
        library,
        status: 'vulnerable',
        cveIds,
        maxSeverity: maxSeverityOf(linked),
        versionUnconfirmed,
      }
    }

    // OSV reportó vulns pero aún no hay filas en el corpus filtrado: no inflar el conteo.
    if (osvHit && osvHit.vulnIds.length > 0) {
      return {
        library,
        status: 'vulnerable',
        cveIds: [],
        maxSeverity: null,
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
      status: wasQueried ? 'clean' : 'unchecked',
      cveIds: [],
      maxSeverity: null,
      versionUnconfirmed,
    }
  })
}
