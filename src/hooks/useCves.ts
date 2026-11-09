import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { AppSourcesConfig } from '../config/sources.schema'
import { findSource } from '../config/sources.schema'
import { aggregate, riskScore } from '../lib/aggregate'
import { applyTechnologyTags } from '../lib/matchTechnologies'
import { fetchEpss } from '../sources/epss'
import { fetchGithub } from '../sources/github'
import { fetchKev } from '../sources/kev'
import { fetchNvd } from '../sources/nvd'
import { useFilters } from '../store/filters'
import type { CveRecord, SourceId } from '../types'
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

/** Prioriza stack + severidad y limita IDs para no saturar EPSS/red. */
function pickEpssIds(tagged: CveRecord[]): string[] {
  const withStack = tagged.filter((c) => c.technologies.length > 0)
  const pool = withStack.length > 0 ? withStack : tagged
  return pool
    .filter((c) => c.id.startsWith('CVE-'))
    .sort((a, b) => severityRank(b) - severityRank(a) || (b.cvss ?? 0) - (a.cvss ?? 0))
    .slice(0, EPSS_MAX_IDS)
    .map((c) => c.id)
}

function fingerprintIds(ids: string[]): string {
  if (ids.length === 0) return '0'
  return `${ids.length}:${ids[0]}:${ids[ids.length - 1]}:${ids[Math.floor(ids.length / 2)]}`
}

export function useCves() {
  const { config } = useSourcesConfig()
  const { days, sources, refreshMin } = useFilters()
  const interval = refreshMin > 0 ? refreshMin * 60_000 : false
  const opts = { refetchInterval: interval, staleTime: 5 * 60_000, retry: 1 } as const

  const nvdConfigOn = sourceEnabledInConfig(config, 'nvd')
  const ghConfigOn = sourceEnabledInConfig(config, 'github')
  const kevConfigOn = sourceEnabledInConfig(config, 'kev')
  const epssConfigOn = sourceEnabledInConfig(config, 'epss')

  const nvdOn = nvdConfigOn && sources.includes('nvd')
  const ghOn = ghConfigOn && sources.includes('github')

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
  const kev = useQuery({
    queryKey: ['kev'],
    queryFn: ({ signal }) => fetchKev(signal),
    enabled: kevConfigOn,
    ...opts,
    staleTime: 60 * 60_000,
  })

  const base = useMemo(
    () =>
      aggregate(
        days,
        nvdOn ? nvd.data : [],
        ghOn ? github.data : [],
        kevConfigOn ? kev.data : undefined,
      ),
    [days, nvdOn, ghOn, kevConfigOn, nvd.data, github.data, kev.data],
  )

  const tagged = useMemo(
    () => applyTechnologyTags(base, config.technologies),
    [base, config.technologies],
  )

  const epssIds = useMemo(() => pickEpssIds(tagged), [tagged])
  const epssFingerprint = useMemo(() => fingerprintIds(epssIds), [epssIds])

  const epss = useQuery({
    queryKey: ['epss', epssFingerprint],
    queryFn: ({ signal }) => fetchEpss(epssIds, signal),
    enabled: epssConfigOn && epssIds.length > 0,
    staleTime: 6 * 60 * 60_000,
    retry: 1,
  })

  const records: CveRecord[] = useMemo(() => {
    if (!epss.data) return tagged
    return tagged.map((c) => {
      const score = epss.data.get(c.id)
      return score ? { ...c, epss: score } : c
    })
  }, [tagged, epss.data])

  const kevInWindow = useMemo(
    () => records.reduce((count, r) => (r.sources.includes('kev') ? count + 1 : count), 0),
    [records],
  )

  const nvdMeta = findSource(config, 'nvd')
  const ghMeta = findSource(config, 'github')
  const kevMeta = findSource(config, 'kev')
  const epssMeta = findSource(config, 'epss')

  const healthList: SourceHealth[] = [
    health('nvd', nvdMeta?.label ?? 'NVD', nvd, nvdOn, nvd.data?.length, nvdMeta?.baseUrl),
    health('github', ghMeta?.label ?? 'GitHub', github, ghOn, github.data?.length, ghMeta?.baseUrl),
    health('kev', kevMeta?.label ?? 'KEV', kev, kevConfigOn, kev.data ? kevInWindow : undefined, kevMeta?.baseUrl),
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
    health: healthList,
    isFetching: nvd.isFetching || github.isFetching || kev.isFetching || epss.isFetching,
    refetchAll: () => healthList.forEach((h) => h.refetch()),
  }
}

/** Aplica filtros de UI en un solo pase y ordena por riesgo. */
export function useFilteredCves(records: CveRecord[]) {
  const { severities, sources, kevOnly, stackOnly, techAll, technologies, minEpss, search } = useFilters()
  return useMemo(() => {
    const q = search.trim().toLowerCase()
    const severitySet = new Set(severities)
    const sourceSet = new Set(sources)
    const techSet = !techAll && technologies.length > 0 ? new Set(technologies) : null
    const techNone = !techAll && technologies.length === 0

    const filtered = records.filter((c) => {
      if (!severitySet.has(c.severity)) return false
      if (!c.sources.some((s) => sourceSet.has(s as SourceId))) return false
      if (kevOnly && !c.kev) return false
      if (stackOnly && c.technologies.length === 0) return false
      if (techNone) return false
      if (techSet && !c.technologies.some((techId) => techSet.has(techId))) return false
      if (minEpss > 0 && (c.epss?.score ?? 0) < minEpss) return false
      if (!q) return true
      return (
        c.id.toLowerCase().includes(q)
        || (c.title ?? '').toLowerCase().includes(q)
        || c.description.toLowerCase().includes(q)
        || c.aliases.some((a) => a.toLowerCase().includes(q))
        || c.packages.some((p) => p.toLowerCase().includes(q))
        || c.technologies.some((t) => t.includes(q))
      )
    })

    filtered.sort((a, b) => riskScore(b) - riskScore(a))
    return filtered
  }, [records, severities, sources, kevOnly, stackOnly, techAll, technologies, minEpss, search])
}
