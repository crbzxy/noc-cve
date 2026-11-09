import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { AppSourcesConfig, WatchedPackage } from '../config/sources.schema'
import { findSource } from '../config/sources.schema'
import { aggregate, riskScore } from '../lib/aggregate'
import { applyLibraryMatches, buildLibraryRiskRows, type LibraryRiskRow } from '../lib/matchLibraries'
import { applyTechnologyTags } from '../lib/matchTechnologies'
import { packageKeyOf, resolveAppStack } from '../lib/resolveAppStack'
import { fetchCveOrg } from '../sources/cveorg'
import { fetchEpss } from '../sources/epss'
import { fetchEuvd } from '../sources/euvd'
import { fetchGithub } from '../sources/github'
import { fetchKev } from '../sources/kev'
import { fetchNvd } from '../sources/nvd'
import { fetchOsvMatch } from '../sources/osv'
import { fetchVulncheckKev } from '../sources/vulncheckKev'
import { fetchWordfence } from '../sources/wordfence'
import { useFilters } from '../store/filters'
import type { CveRecord, SourceId } from '../types'
import { useAppsConfig } from './useAppsConfig'
import { useSourcesConfig } from './useSourcesConfig'

/** Tope de CVEs a enriquecer con EPSS (los más relevantes del stack). */
const EPSS_MAX_IDS = 250

export interface SourceHealth {
  id: string
  label: string
  baseUrl?: string
  status: 'loading' | 'ok' | 'error' | 'off'
  count?: number
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
): SourceHealth {
  return {
    id,
    label,
    baseUrl,
    status: !enabled ? 'off' : q.isError ? 'error' : q.isPending ? 'loading' : 'ok',
    count,
    error: q.error instanceof Error ? q.error.message : undefined,
    updatedAt: q.dataUpdatedAt || undefined,
    refetch: () => void q.refetch(),
  }
}

function sourceEnabledInConfig(config: AppSourcesConfig, id: string): boolean {
  return findSource(config, id)?.enabled !== false
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

function countBySource(records: CveRecord[], sourceId: SourceId): number {
  return records.reduce((count, record) => (record.sources.includes(sourceId) ? count + 1 : count), 0)
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

export function useCves() {
  const { config } = useSourcesConfig()
  const { options: appOptions } = useAppsConfig()
  const { days, sources, refreshMin, selectedAppId } = useFilters()
  const interval = refreshMin > 0 ? refreshMin * 60_000 : false
  const opts = { refetchInterval: interval, staleTime: 5 * 60_000, retry: 1 } as const

  const selectedApp = useMemo(
    () => appOptions.find((option) => option.id === selectedAppId) ?? null,
    [appOptions, selectedAppId],
  )
  const appStack = useMemo(
    () => (selectedApp ? resolveAppStack(selectedApp.entry) : null),
    [selectedApp],
  )
  const watchedPackages = useMemo(
    () => mergeWatchedPackages(config.watchedPackages ?? [], appStack?.watchedPackages ?? []),
    [config.watchedPackages, appStack],
  )

  const nvdConfigOn = sourceEnabledInConfig(config, 'nvd')
  const ghConfigOn = sourceEnabledInConfig(config, 'github')
  const cveorgConfigOn = sourceEnabledInConfig(config, 'cveorg')
  const wordfenceConfigOn = sourceEnabledInConfig(config, 'wordfence')
  const osvConfigOn = sourceEnabledInConfig(config, 'osv')
  const euvdConfigOn = sourceEnabledInConfig(config, 'euvd')
  const kevConfigOn = sourceEnabledInConfig(config, 'kev')
  const vulncheckConfigOn = sourceEnabledInConfig(config, 'vulncheck-kev')
  const epssConfigOn = sourceEnabledInConfig(config, 'epss')

  const nvdOn = nvdConfigOn && sources.includes('nvd')
  const ghOn = ghConfigOn && sources.includes('github')
  const cveorgOn = cveorgConfigOn && sources.includes('cveorg')
  const wordfenceOn = wordfenceConfigOn && sources.includes('wordfence')
  const osvOn = osvConfigOn && sources.includes('osv') && watchedPackages.length > 0
  const euvdOn = euvdConfigOn && sources.includes('euvd')

  const nvd = useQuery({
    queryKey: ['nvd', days],
    queryFn: ({ signal }) => fetchNvd(days, signal),
    enabled: nvdOn,
    ...opts,
  })
  const github = useQuery({
    queryKey: ['github', days],
    queryFn: ({ signal }) => fetchGithub(days, signal),
    enabled: ghOn,
    ...opts,
  })
  const cveorg = useQuery({
    queryKey: ['cveorg', days],
    queryFn: ({ signal }) => fetchCveOrg(days, signal),
    enabled: cveorgOn,
    ...opts,
  })
  const wordfence = useQuery({
    queryKey: ['wordfence', days],
    queryFn: ({ signal }) => fetchWordfence(days, signal),
    enabled: wordfenceOn,
    ...opts,
    staleTime: 60 * 60_000,
  })
  const osv = useQuery({
    queryKey: ['osv', watchedPackages],
    queryFn: ({ signal }) => fetchOsvMatch(watchedPackages, signal),
    enabled: osvOn,
    ...opts,
    staleTime: 60 * 60_000,
  })
  const euvd = useQuery({
    queryKey: ['euvd', days],
    queryFn: ({ signal }) => fetchEuvd(days, signal),
    enabled: euvdOn,
    ...opts,
  })
  const kev = useQuery({
    queryKey: ['kev'],
    queryFn: ({ signal }) => fetchKev(signal),
    enabled: kevConfigOn,
    ...opts,
    staleTime: 60 * 60_000,
  })
  const vulncheckKev = useQuery({
    queryKey: ['vulncheck-kev'],
    queryFn: ({ signal }) => fetchVulncheckKev(signal),
    enabled: vulncheckConfigOn,
    ...opts,
    staleTime: 60 * 60_000,
  })

  const osvRecords = useMemo(
    () => (osvOn ? osv.data?.records ?? [] : []),
    [osvOn, osv.data],
  )
  const packageHits = useMemo(
    () => (osvOn ? osv.data?.packageHits ?? [] : []),
    [osvOn, osv.data],
  )

  const base = useMemo(
    () =>
      aggregate({
        days,
        lists: [
          nvdOn ? nvd.data ?? [] : [],
          ghOn ? github.data ?? [] : [],
          cveorgOn ? cveorg.data ?? [] : [],
          wordfenceOn ? wordfence.data ?? [] : [],
          osvRecords,
          euvdOn ? euvd.data ?? [] : [],
        ],
        kev: kevConfigOn ? kev.data : undefined,
        vulncheckKev: vulncheckConfigOn ? vulncheckKev.data : undefined,
      }),
    [
      days, nvdOn, ghOn, cveorgOn, wordfenceOn, euvdOn, kevConfigOn, vulncheckConfigOn,
      nvd.data, github.data, cveorg.data, wordfence.data, osvRecords, euvd.data, kev.data, vulncheckKev.data,
    ],
  )

  const tagged = useMemo(
    () => applyTechnologyTags(base, config.technologies),
    [base, config.technologies],
  )

  const withLibraries = useMemo(
    () => applyLibraryMatches(tagged, appStack?.libraries ?? [], packageHits),
    [tagged, appStack, packageHits],
  )

  const epssIds = useMemo(() => pickEpssIds(withLibraries), [withLibraries])
  const epssFingerprint = useMemo(() => fingerprintIds(epssIds), [epssIds])

  const epss = useQuery({
    queryKey: ['epss', epssFingerprint],
    queryFn: ({ signal }) => fetchEpss(epssIds, signal),
    enabled: epssConfigOn && epssIds.length > 0,
    staleTime: 6 * 60 * 60_000,
    retry: 1,
  })

  const records: CveRecord[] = useMemo(() => {
    if (!epss.data) return withLibraries
    return withLibraries.map((c) => {
      const score = epss.data.get(c.id)
      return score ? { ...c, epss: score } : c
    })
  }, [withLibraries, epss.data])

  const libraryRisk: LibraryRiskRow[] = useMemo(() => {
    if (!appStack) return []
    return buildLibraryRiskRows(appStack.libraries, records, packageHits)
  }, [appStack, records, packageHits])

  const nvdMeta = findSource(config, 'nvd')
  const ghMeta = findSource(config, 'github')
  const cveorgMeta = findSource(config, 'cveorg')
  const wordfenceMeta = findSource(config, 'wordfence')
  const osvMeta = findSource(config, 'osv')
  const euvdMeta = findSource(config, 'euvd')
  const kevMeta = findSource(config, 'kev')
  const vulncheckMeta = findSource(config, 'vulncheck-kev')
  const epssMeta = findSource(config, 'epss')

  const healthList: SourceHealth[] = [
    health('nvd', nvdMeta?.label ?? 'NVD', nvd, nvdOn, nvd.data?.length, nvdMeta?.baseUrl),
    health('github', ghMeta?.label ?? 'GitHub', github, ghOn, github.data?.length, ghMeta?.baseUrl),
    health('cveorg', cveorgMeta?.label ?? 'CVE.org', cveorg, cveorgOn, cveorg.data?.length, cveorgMeta?.baseUrl),
    health('wordfence', wordfenceMeta?.label ?? 'Wordfence', wordfence, wordfenceOn, wordfence.data?.length, wordfenceMeta?.baseUrl),
    health(
      'osv',
      osvMeta?.label ?? 'OSV',
      osv,
      osvConfigOn && sources.includes('osv'),
      osvOn ? osvRecords.length : 0,
      osvMeta?.baseUrl,
    ),
    health('euvd', euvdMeta?.label ?? 'EUVD', euvd, euvdOn, euvd.data?.length, euvdMeta?.baseUrl),
    health('kev', kevMeta?.label ?? 'KEV', kev, kevConfigOn, kev.data ? countBySource(records, 'kev') : undefined, kevMeta?.baseUrl),
    health(
      'vulncheck-kev',
      vulncheckMeta?.label ?? 'VulnCheck KEV',
      vulncheckKev,
      vulncheckConfigOn,
      vulncheckKev.data ? countBySource(records, 'vulncheck-kev') : undefined,
      vulncheckMeta?.baseUrl,
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

  return {
    records,
    libraryRisk,
    libraryRiskLoading: Boolean(selectedAppId) && osvOn && osv.isFetching,
    health: healthList,
    isFetching:
      nvd.isFetching || github.isFetching || cveorg.isFetching || wordfence.isFetching
      || osv.isFetching || euvd.isFetching || kev.isFetching || vulncheckKev.isFetching || epss.isFetching,
    refetchAll: () => healthList.forEach((h) => h.refetch()),
  }
}

/** Aplica filtros de UI en un solo pase y ordena por riesgo. */
export function useFilteredCves(records: CveRecord[]) {
  const { options: appOptions } = useAppsConfig()
  const {
    severities, sources, kevOnly, techAll, technologies, minEpss, search,
    selectedAppId, selectedLibrary,
  } = useFilters()

  const appStack = useMemo(() => {
    if (!selectedAppId) return null
    const option = appOptions.find((item) => item.id === selectedAppId)
    return option ? resolveAppStack(option.entry) : null
  }, [appOptions, selectedAppId])

  return useMemo(() => {
    const q = search.trim().toLowerCase()
    const severitySet = new Set(severities)
    const sourceSet = new Set(sources)
    const appTechSet = appStack ? new Set(appStack.techIds) : null
    const techSet = !appTechSet && !techAll && technologies.length > 0 ? new Set(technologies) : null
    const techNone = !appTechSet && !techAll && technologies.length === 0

    const filtered = records.filter((c) => {
      if (!severitySet.has(c.severity)) return false
      if (!c.sources.some((s) => sourceSet.has(s as SourceId))) return false
      if (kevOnly && !c.kev) return false
      if (techNone) return false

      // App con inventario: solo CVEs de sus librerías (no todo Java/Spring del catálogo).
      if (selectedLibrary) {
        if (!c.matchedLibraries.includes(selectedLibrary)) return false
      } else if (appStack && appStack.libraries.length > 0) {
        if (c.matchedLibraries.length === 0) return false
      } else if (appTechSet) {
        if (!c.technologies.some((techId) => appTechSet.has(techId))) return false
      } else if (techSet && !c.technologies.some((techId) => techSet.has(techId))) {
        return false
      }

      if (minEpss > 0 && (c.epss?.score ?? 0) < minEpss) return false
      if (!q) return true
      return (
        c.id.toLowerCase().includes(q)
        || (c.title ?? '').toLowerCase().includes(q)
        || c.description.toLowerCase().includes(q)
        || c.aliases.some((a) => a.toLowerCase().includes(q))
        || c.packages.some((p) => p.toLowerCase().includes(q))
        || c.technologies.some((t) => t.includes(q))
        || c.matchedLibraries.some((lib) => lib.toLowerCase().includes(q))
      )
    })

    filtered.sort((a, b) => riskScore(b) - riskScore(a))
    return filtered
  }, [
    records, severities, sources, kevOnly, techAll, technologies, minEpss,
    search, appStack, selectedLibrary,
  ])
}
