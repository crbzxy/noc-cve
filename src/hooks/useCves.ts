import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import type { WatchedPackage } from '../config/sources.schema'
import { findSource } from '../config/sources.schema'
import type { CorpusSnapshot } from '../corpus/types'
import { aggregate, riskScore } from '../lib/aggregate'
import {
  CORPUS_REFRESH_MS,
  CORPUS_WINDOW_DAYS,
  isInTimeWindow,
} from '../lib/corpusWindow'
import { applyLibraryMatches } from '../lib/matchLibraries'
import { applyTechnologyTags } from '../lib/matchTechnologies'
import {
  appStackUsesTechFallback,
  packageKeyOf,
  resolveAppStackCached,
  type ResolvedAppStack,
  type TrackedLibrary,
} from '../lib/resolveAppStack'
import { compileSearchPattern, textMatchesSearch } from '../lib/searchText'
import { fetchCorpus, refreshCorpus } from '../sources/corpus'
import { fetchEpss } from '../sources/epss'
import { fetchOsvDetails, fetchOsvHits } from '../sources/osv'
import { useFilters } from '../store/filters'
import type { CveRecord, SourceId } from '../types'
import { useAppsConfig } from './useAppsConfig'
import { useSourcesConfig } from './useSourcesConfig'

/** Tope de CVEs a enriquecer con EPSS (los más relevantes del stack). */
const EPSS_MAX_IDS = 250
/** Tope de paquetes OSV cuando no hay app seleccionada (todas las apps). */
const OSV_GLOBAL_PACKAGE_CAP = 80
/** Referencias estables: evita re-renders por `?? []` en cada render de useCves. */
const EMPTY_LIBRARIES: TrackedLibrary[] = []
const EMPTY_CRITICAL_IDS: string[] = []

export interface SourceHealth {
  id: string
  label: string
  baseUrl?: string
  status: 'loading' | 'ok' | 'error' | 'off'
  count?: number
  detail?: string
  error?: string
  updatedAt?: number
  refetch: () => void
}

function health(
  id: string,
  label: string,
  q: UseQueryResult<unknown>,
  enabled: boolean,
  count?: number,
  baseUrl?: string,
  detail?: string,
): SourceHealth {
  // Query deshabilitada (p.ej. OSV sin paquetes) no debe quedar en "Consultando…" eterno.
  const waiting = enabled && q.isFetching && !q.data && !q.isError
  return {
    id,
    label,
    baseUrl,
    status: !enabled ? 'off' : q.isError ? 'error' : waiting ? 'loading' : 'ok',
    count,
    detail,
    error: q.error instanceof Error ? q.error.message : undefined,
    updatedAt: q.dataUpdatedAt || undefined,
    refetch: () => void q.refetch(),
  }
}

function sourceEnabledInConfig(enabled: boolean | undefined): boolean {
  return enabled !== false
}

function severityRank(record: CveRecord): number {
  if (record.kev) return 5
  if (record.severity === 'CRITICAL') return 4
  if (record.severity === 'HIGH') return 3
  if (record.severity === 'MEDIUM') return 2
  if (record.severity === 'LOW') return 1
  return 0
}

/** Prioriza stack/librerías + severidad y limita IDs para no saturar EPSS/red. */
function pickEpssIds(tagged: CveRecord[]): string[] {
  const withHit = tagged.filter((c) => c.technologies.length > 0 || c.matchedLibraries.length > 0)
  const pool = withHit.length > 0 ? withHit : tagged
  return pool
    .filter((c) => c.id.startsWith('CVE-'))
    .sort((a, b) => severityRank(b) - severityRank(a) || (b.cvss ?? 0) - (a.cvss ?? 0))
    .slice(0, EPSS_MAX_IDS)
    .map((c) => c.id)
}

function fingerprintIds(ids: string[]): string {
  if (ids.length === 0) return '0'
  let hash = 2166136261
  for (const id of ids) {
    for (let index = 0; index < id.length; index += 1) {
      hash ^= id.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }
    hash ^= 124
    hash = Math.imul(hash, 16777619)
  }
  return `${ids.length}:${(hash >>> 0).toString(16)}`
}

function mergeWatchedPackages(
  fromConfig: WatchedPackage[],
  fromApp: WatchedPackage[],
): WatchedPackage[] {
  const map = new Map<string, WatchedPackage>()
  for (const pkg of [...fromConfig, ...fromApp]) {
    map.set(packageKeyOf(pkg.ecosystem, pkg.name, pkg.version), pkg)
  }
  return [...map.values()]
}

/**
 * Paquetes con versión del inventario de apps para OSV.
 * Si `techFilter` tiene ids, solo apps cuyo stack incluye alguna de esas tecnologías.
 */
function collectWatchedPackagesForTechs(
  options: Array<{ id: string; entry: Parameters<typeof resolveAppStackCached>[1] }>,
  cap: number,
  techFilter: string[] | null,
): WatchedPackage[] {
  const techSet = techFilter && techFilter.length > 0 ? new Set(techFilter) : null
  const map = new Map<string, WatchedPackage>()
  for (const option of options) {
    const stack = resolveAppStackCached(option.id, option.entry)
    if (techSet && !stack.techIds.some((techId) => techSet.has(techId))) continue
    for (const pkg of stack.watchedPackages) {
      if (!pkg.version) continue
      const key = packageKeyOf(pkg.ecosystem, pkg.name, pkg.version)
      if (map.has(key)) continue
      map.set(key, pkg)
      if (map.size >= cap) return [...map.values()]
    }
  }
  return [...map.values()]
}

function corpusSourceHealth(
  snapshot: CorpusSnapshot | undefined,
  id: string,
  label: string,
  baseUrl: string | undefined,
  refetch: () => void,
  enabled: boolean,
): SourceHealth {
  if (!enabled) {
    return { id, label, baseUrl, status: 'off', refetch }
  }
  const row = snapshot?.sources.find((source) => source.id === id)
  if (!snapshot) {
    return { id, label, baseUrl, status: 'loading', refetch }
  }
  if (!row) {
    return { id, label, baseUrl, status: 'ok', count: 0, updatedAt: snapshot.generatedAt, refetch }
  }
  return {
    id,
    label: row.label || label,
    baseUrl,
    status: row.status === 'error' ? 'error' : row.status === 'off' ? 'off' : 'ok',
    count: row.count,
    error: row.error,
    updatedAt: row.updatedAt ?? snapshot.generatedAt,
    refetch,
  }
}

export function useCves() {
  const { config } = useSourcesConfig()
  const { options: appOptions } = useAppsConfig()
  const { days, sources, refreshMin, selectedAppId, techAll, technologies } = useFilters()
  const interval = refreshMin > 0 ? refreshMin * 60_000 : CORPUS_REFRESH_MS
  const enrichmentOpts = { refetchInterval: interval, staleTime: CORPUS_REFRESH_MS, retry: 1 } as const

  const selectedApp = useMemo(
    () => appOptions.find((option) => option.id === selectedAppId) ?? null,
    [appOptions, selectedAppId],
  )
  const appStack = useMemo(
    () => (selectedApp ? resolveAppStackCached(selectedApp.id, selectedApp.entry) : null),
    [selectedApp],
  )
  const watchedPackages = useMemo(() => {
    const fromConfig = config.watchedPackages ?? []
    if (selectedAppId && appStack) {
      return mergeWatchedPackages(fromConfig, appStack.watchedPackages)
    }
    // Vista global / por tecnología: OSV usa paquetes de apps del stack filtrado.
    const techFilter = !techAll && technologies.length > 0 ? technologies : null
    const fromApps = collectWatchedPackagesForTechs(appOptions, OSV_GLOBAL_PACKAGE_CAP, techFilter)
    return mergeWatchedPackages(fromConfig, fromApps)
  }, [config.watchedPackages, appStack, selectedAppId, appOptions, techAll, technologies])
  const watchedPackagesKey = useMemo(
    () => fingerprintIds(watchedPackages.map((pkg) => packageKeyOf(pkg.ecosystem, pkg.name, pkg.version))),
    [watchedPackages],
  )

  const osvConfigOn = sourceEnabledInConfig(findSource(config, 'osv')?.enabled)
  const epssConfigOn = sourceEnabledInConfig(findSource(config, 'epss')?.enabled)
  const osvFilterOn = osvConfigOn && sources.includes('osv')
  const osvOn = osvFilterOn && watchedPackages.length > 0

  const corpus = useQuery({
    queryKey: ['corpus'],
    queryFn: ({ signal }) => fetchCorpus(signal),
    staleTime: CORPUS_REFRESH_MS,
    refetchInterval: interval,
    gcTime: 30 * 60_000,
    retry: 1,
    placeholderData: keepPreviousData,
  })

  const osvHits = useQuery({
    queryKey: ['osv-hits', watchedPackagesKey],
    queryFn: ({ signal }) => fetchOsvHits(watchedPackages, signal),
    enabled: osvOn,
    ...enrichmentOpts,
    staleTime: 2 * 60 * 60_000,
    gcTime: 4 * 60 * 60_000,
  })

  const packageHits = useMemo(
    () => (osvOn ? osvHits.data?.packageHits ?? [] : []),
    [osvOn, osvHits.data],
  )

  // Corpus completo por fuentes; la ventana de días se aplica al final (también con app).
  const sourceFiltered = useMemo(() => {
    const enabled = new Set(sources)
    const all = corpus.data?.records ?? []
    return all.filter((record) => record.sources.some((source) => enabled.has(source as SourceId)))
  }, [corpus.data?.records, sources])

  const withoutWordfence = useMemo(
    () => sourceFiltered.filter((record) => record.sources.some((source) => source !== 'wordfence')),
    [sourceFiltered],
  )

  // App = inventario por versión. Sin app = feed de noticias.
  // La ventana de días se aplica al filtrar la vista; si queda vacía se amplía a 90 d.
  const inventoryMode = Boolean(selectedAppId && (appStack?.libraries.length ?? 0) > 0)

  const matchCorpus = useMemo(() => {
    return inventoryMode ? withoutWordfence : sourceFiltered
  }, [inventoryMode, withoutWordfence, sourceFiltered])

  const knownIds = useMemo(() => {
    const ids = new Set<string>()
    for (const record of matchCorpus) {
      ids.add(record.id)
      for (const alias of record.aliases) ids.add(alias)
    }
    return ids
  }, [matchCorpus])

  const osvDetails = useQuery({
    queryKey: ['osv-details', watchedPackagesKey, inventoryMode ? 'inventory' : `news-${days}`],
    queryFn: ({ signal }) => fetchOsvDetails(osvHits.data?.packageHits ?? [], knownIds, signal),
    enabled: osvOn && Boolean(osvHits.data) && (osvHits.data?.packageHits.length ?? 0) > 0,
    staleTime: 2 * 60 * 60_000,
    gcTime: 4 * 60 * 60_000,
    retry: 1,
  })

  const withOsvDetails = useMemo(() => {
    if (!osvDetails.data || osvDetails.data.length === 0) return matchCorpus
    const merged = aggregate({
      days: CORPUS_WINDOW_DAYS,
      lists: [matchCorpus, osvDetails.data],
    })
    return applyTechnologyTags(merged, config.technologies)
  }, [matchCorpus, osvDetails.data, config.technologies])

  const withLibraries = useMemo(
    () => applyLibraryMatches(withOsvDetails, appStack?.libraries ?? [], packageHits),
    [withOsvDetails, appStack, packageHits],
  )

  const epssIds = useMemo(() => pickEpssIds(withLibraries), [withLibraries])
  const epssFingerprint = useMemo(() => fingerprintIds(epssIds), [epssIds])

  const epss = useQuery({
    queryKey: ['epss', epssFingerprint],
    queryFn: ({ signal }) => fetchEpss(epssIds, signal),
    enabled: epssConfigOn && epssIds.length > 0,
    staleTime: 6 * 60 * 60_000,
    placeholderData: keepPreviousData,
    retry: 1,
  })

  const records: CveRecord[] = useMemo(() => {
    if (!epss.data) return withLibraries
    return withLibraries.map((c) => {
      const score = epss.data.get(c.id)
      return score ? { ...c, epss: score } : c
    })
  }, [withLibraries, epss.data])

  const nvdMeta = findSource(config, 'nvd')
  const ghMeta = findSource(config, 'github')
  const cveorgMeta = findSource(config, 'cveorg')
  const wordfenceMeta = findSource(config, 'wordfence')
  const osvMeta = findSource(config, 'osv')
  const euvdMeta = findSource(config, 'euvd')
  const kevMeta = findSource(config, 'kev')
  const vulncheckMeta = findSource(config, 'vulncheck-kev')
  const epssMeta = findSource(config, 'epss')

  const refetchCorpusQuery = corpus.refetch
  const reloadCorpus = useCallback(() => {
    void refreshCorpus()
      .then(() => refetchCorpusQuery())
      .catch(() => refetchCorpusQuery())
  }, [refetchCorpusQuery])

  const healthList: SourceHealth[] = useMemo(() => {
    const snapshot = corpus.data
    return [
      corpusSourceHealth(snapshot, 'nvd', nvdMeta?.label ?? 'NVD', nvdMeta?.baseUrl, reloadCorpus, sourceEnabledInConfig(nvdMeta?.enabled)),
      corpusSourceHealth(snapshot, 'github', ghMeta?.label ?? 'GitHub', ghMeta?.baseUrl, reloadCorpus, sourceEnabledInConfig(ghMeta?.enabled)),
      corpusSourceHealth(snapshot, 'cveorg', cveorgMeta?.label ?? 'CVE.org', cveorgMeta?.baseUrl, reloadCorpus, sourceEnabledInConfig(cveorgMeta?.enabled)),
      corpusSourceHealth(snapshot, 'wordfence', wordfenceMeta?.label ?? 'Wordfence', wordfenceMeta?.baseUrl, reloadCorpus, sourceEnabledInConfig(wordfenceMeta?.enabled)),
      health(
        'osv',
        osvMeta?.label ?? 'OSV',
        osvHits,
        osvFilterOn,
        osvOn ? packageHits.reduce((sum, hit) => sum + hit.vulnIds.length, 0) : 0,
        osvMeta?.baseUrl,
        osvFilterOn && !osvOn
          ? (!techAll && technologies.length > 0
            ? 'Sin paquetes con versión para esas tecnologías'
            : 'Sin paquetes con versión en el inventario')
          : osvOn
            ? (!techAll && technologies.length > 0
              ? `${watchedPackages.length} paquetes · filtro tech`
              : `${watchedPackages.length} paquetes vigilados`)
            : undefined,
      ),
      corpusSourceHealth(snapshot, 'euvd', euvdMeta?.label ?? 'EUVD', euvdMeta?.baseUrl, reloadCorpus, sourceEnabledInConfig(euvdMeta?.enabled)),
      corpusSourceHealth(snapshot, 'kev', kevMeta?.label ?? 'KEV', kevMeta?.baseUrl, reloadCorpus, sourceEnabledInConfig(kevMeta?.enabled)),
      corpusSourceHealth(
        snapshot,
        'vulncheck-kev',
        vulncheckMeta?.label ?? 'VulnCheck KEV',
        vulncheckMeta?.baseUrl,
        reloadCorpus,
        sourceEnabledInConfig(vulncheckMeta?.enabled),
      ),
      health(
        'epss',
        epssMeta?.label ?? 'EPSS',
        epss,
        epssConfigOn && epssIds.length > 0,
        epss.data?.size,
        epssMeta?.baseUrl,
      ),
    ]
  }, [
    corpus.data, osvHits, epss, osvOn, osvFilterOn, watchedPackages.length, epssConfigOn, epssIds.length,
    sources, packageHits, techAll, technologies,
    nvdMeta, ghMeta, cveorgMeta, wordfenceMeta, osvMeta, euvdMeta, kevMeta, vulncheckMeta, epssMeta,
    reloadCorpus,
  ])

  return {
    records,
    packageHits,
    appLibraries: appStack?.libraries ?? EMPTY_LIBRARIES,
    libraryRiskLoading: Boolean(selectedAppId) && osvOn && osvHits.isFetching,
    health: healthList,
    corpusGeneratedAt: corpus.data?.generatedAt ?? null,
    corpusIngestMs: corpus.data?.ingestMs ?? null,
    newCriticalIds: corpus.data?.newCriticalIds ?? EMPTY_CRITICAL_IDS,
    isFetching: corpus.isFetching || osvHits.isFetching || epss.isFetching,
    /** Solo la primera carga: después keepPreviousData mantiene la vista mientras refresca. */
    initialLoading: corpus.isPending,
    refetchAll: () => {
      reloadCorpus()
      void osvHits.refetch()
      void epss.refetch()
    },
  }
}

function buildSearchHaystack(record: CveRecord): string {
  return [
    record.id,
    record.title ?? '',
    record.description,
    record.aliases.join(' '),
    record.packages.join(' '),
    record.technologies.join(' '),
    record.matchedLibraries.join(' '),
  ].join('\n')
}

type FilterCveOptions = {
  severities: Set<string>
  sources: Set<string>
  kevOnly: boolean
  techAll: boolean
  technologies: string[]
  minEpss: number
  search: string
  days: number
  inventoryMode: boolean
  appStack: ResolvedAppStack | null
  selectedLibrary: string | null
  ignoreLibraryFilter?: boolean
}

function passesTimeWindow(record: CveRecord, days: number, inventoryMode: boolean): boolean {
  if (days >= CORPUS_WINDOW_DAYS) return true
  if (isInTimeWindow(record, days)) return true
  if (!inventoryMode || record.matchedLibraries.length === 0) return false
  return record.severity === 'CRITICAL' || record.severity === 'HIGH'
}

function passesSearch(record: CveRecord, query: string, pattern: RegExp | null): boolean {
  if (!pattern) return true
  if (record.id.toLowerCase().includes(query)) return true
  if (record.aliases.some((alias) => alias.toLowerCase().includes(query))) return true
  return textMatchesSearch(buildSearchHaystack(record), pattern)
}

function passesStackFilters(record: CveRecord, options: FilterCveOptions): boolean {
  const appTechSet = options.appStack ? new Set(options.appStack.techIds) : null
  const appScopeTechSet = options.appStack ? new Set(options.appStack.scopeTechIds) : null
  const techFallback = Boolean(options.appStack && appStackUsesTechFallback(options.appStack))
  const techSet = !appTechSet && !options.techAll && options.technologies.length > 0
    ? new Set(options.technologies)
    : null
  const techNone = !appTechSet && !options.techAll && options.technologies.length === 0
  if (techNone) return false

  const libraryFilter = options.ignoreLibraryFilter ? null : options.selectedLibrary
  if (libraryFilter) return record.matchedLibraries.includes(libraryFilter)

  if (options.appStack && options.appStack.libraries.length > 0) {
    const libraryHit = record.matchedLibraries.length > 0
    const scopeTechHit = Boolean(
      appScopeTechSet
      && record.technologies.some((techId) => appScopeTechSet.has(techId)),
    )
    return libraryHit || (techFallback && scopeTechHit)
  }
  if (appTechSet) return record.technologies.some((techId) => appTechSet.has(techId))
  if (techSet) return record.technologies.some((techId) => techSet.has(techId))
  return true
}

function filterCveRecords(records: CveRecord[], options: FilterCveOptions): CveRecord[] {
  const query = options.search.trim().toLowerCase()
  const searchPattern = query ? compileSearchPattern(query) : null

  const filtered = records.filter((record) => {
    if (!passesTimeWindow(record, options.days, options.inventoryMode)) return false
    if (!options.severities.has(record.severity)) return false
    if (!record.sources.some((source) => options.sources.has(source as SourceId))) return false
    if (options.kevOnly && !record.kev) return false
    if (!passesStackFilters(record, options)) return false
    if (options.minEpss > 0 && (record.epss?.score ?? 0) < options.minEpss) return false
    return passesSearch(record, query, searchPattern)
  })

  filtered.sort((a, b) => riskScore(b) - riskScore(a))
  return filtered
}

function windowLabel(days: number): string {
  if (days === 1) return '24 h'
  if (days === 90) return '3 m'
  return `${days} d`
}

/**
 * Un solo pase de filtros: scope de app (para librerías) + filas de tabla CVE.
 * Si la ventana elegida queda vacía, amplía a 90 días automáticamente.
 */
export function useCveViews(records: CveRecord[]) {
  const { options: appOptions } = useAppsConfig()
  const {
    severities, sources, kevOnly, techAll, technologies, minEpss, search, days,
    selectedAppId, selectedLibrary,
  } = useFilters()

  const appStack = useMemo(() => {
    if (!selectedAppId) return null
    const option = appOptions.find((item) => item.id === selectedAppId)
    return option ? resolveAppStackCached(option.id, option.entry) : null
  }, [appOptions, selectedAppId])

  const inventoryMode = Boolean(selectedAppId && (appStack?.libraries.length ?? 0) > 0)

  return useMemo(() => {
    const baseOptions: FilterCveOptions = {
      severities: new Set(severities),
      sources: new Set(sources),
      kevOnly,
      techAll,
      technologies,
      minEpss,
      search,
      days,
      inventoryMode,
      appStack,
      selectedLibrary: null,
      ignoreLibraryFilter: true,
    }

    let libraryScopedRows = filterCveRecords(records, baseOptions)
    let windowFallback = false
    if (libraryScopedRows.length === 0 && days < CORPUS_WINDOW_DAYS) {
      const wider = filterCveRecords(records, {
        ...baseOptions,
        days: CORPUS_WINDOW_DAYS,
      })
      if (wider.length > 0) {
        libraryScopedRows = wider
        windowFallback = true
      }
    }

    const rows = selectedLibrary
      ? libraryScopedRows.filter((record) => record.matchedLibraries.includes(selectedLibrary))
      : libraryScopedRows

    return {
      rows,
      libraryScopedRows,
      windowFallback,
      fallbackHint: windowFallback
        ? `Sin hallazgos en ${windowLabel(days)} · mostrando últimos ${windowLabel(CORPUS_WINDOW_DAYS)}`
        : null,
    }
  }, [
    records, severities, sources, kevOnly, techAll, technologies, minEpss,
    search, days, inventoryMode, appStack, selectedLibrary,
  ])
}

/** @deprecated Prefer useCveViews para un solo pase de filtros. */
export function useFilteredCves(records: CveRecord[]) {
  return useCveViews(records).rows
}

/** @deprecated Prefer useCveViews para un solo pase de filtros. */
export function useLibraryScopedCves(records: CveRecord[]) {
  return useCveViews(records).libraryScopedRows
}
