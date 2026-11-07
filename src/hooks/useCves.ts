import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useMemo } from 'react'
import { aggregate, riskScore } from '../lib/aggregate'
import { fetchEpss } from '../sources/epss'
import { fetchGithub } from '../sources/github'
import { fetchKev } from '../sources/kev'
import { fetchNvd } from '../sources/nvd'
import { useFilters } from '../store/filters'
import type { CveRecord, SourceId } from '../types'

export interface SourceHealth {
  id: SourceId | 'epss'
  label: string
  status: 'loading' | 'ok' | 'error' | 'off'
  count?: number
  error?: string
  updatedAt?: number
  refetch: () => void
}

function health(id: SourceHealth['id'], label: string, q: UseQueryResult<unknown>, enabled: boolean, count?: number): SourceHealth {
  return {
    id, label,
    status: !enabled ? 'off' : q.isError ? 'error' : q.isPending ? 'loading' : 'ok',
    count,
    error: q.error instanceof Error ? q.error.message : undefined,
    updatedAt: q.dataUpdatedAt || undefined,
    refetch: () => void q.refetch(),
  }
}

export function useCves() {
  const { days, sources, refreshMin } = useFilters()
  const interval = refreshMin > 0 ? refreshMin * 60_000 : false
  const opts = { refetchInterval: interval, staleTime: 5 * 60_000, retry: 1 } as const

  const nvdOn = sources.includes('nvd')
  const ghOn = sources.includes('github')

  const nvd = useQuery({ queryKey: ['nvd', days], queryFn: ({ signal }) => fetchNvd(days, signal), enabled: nvdOn, ...opts })
  const github = useQuery({ queryKey: ['github', days], queryFn: ({ signal }) => fetchGithub(days, signal), enabled: ghOn, ...opts })
  // KEV siempre se carga: enriquece a las demás fuentes aunque se oculte como fuente de listado
  const kev = useQuery({ queryKey: ['kev'], queryFn: ({ signal }) => fetchKev(signal), ...opts, staleTime: 60 * 60_000 })

  const base = useMemo(
    () =>
      aggregate(
        days,
        nvdOn ? nvd.data : [],
        ghOn ? github.data : [],
        kev.data,
      ),
    [days, nvdOn, ghOn, nvd.data, github.data, kev.data],
  )

  // EPSS depende de los IDs ya fusionados
  const ids = useMemo(() => base.map((c) => c.id).filter((id) => id.startsWith('CVE-')).sort(), [base])
  const epss = useQuery({
    queryKey: ['epss', ids],
    queryFn: ({ signal }) => fetchEpss(ids, signal),
    enabled: ids.length > 0,
    staleTime: 6 * 60 * 60_000, // EPSS se publica 1 vez al día
    retry: 1,
  })

  const records: CveRecord[] = useMemo(() => {
    if (!epss.data) return base
    return base.map((c) => ({ ...c, epss: epss.data.get(c.id) }))
  }, [base, epss.data])

  const kevInWindow = useMemo(() => records.filter((r) => r.sources.includes('kev')).length, [records])

  const healthList: SourceHealth[] = [
    health('nvd', 'NVD (NIST)', nvd, nvdOn, nvd.data?.length),
    health('github', 'GitHub Advisories', github, ghOn, github.data?.length),
    health('kev', 'CISA KEV', kev, true, kev.data ? kevInWindow : undefined),
    health('epss', 'FIRST EPSS', epss, ids.length > 0, epss.data?.size),
  ]

  return {
    records,
    health: healthList,
    isFetching: nvd.isFetching || github.isFetching || kev.isFetching || epss.isFetching,
    refetchAll: () => healthList.forEach((h) => h.refetch()),
  }
}

/** Aplica filtros de UI (no de fetch) y ordena por riesgo. */
export function useFilteredCves(records: CveRecord[]) {
  const { severities, sources, kevOnly, minEpss, search } = useFilters()
  return useMemo(() => {
    const q = search.trim().toLowerCase()
    return records
      .filter((c) => severities.includes(c.severity))
      .filter((c) => c.sources.some((s) => sources.includes(s)))
      .filter((c) => !kevOnly || Boolean(c.kev))
      .filter((c) => minEpss === 0 || (c.epss?.score ?? 0) >= minEpss)
      .filter(
        (c) =>
          !q ||
          c.id.toLowerCase().includes(q) ||
          c.aliases.some((a) => a.toLowerCase().includes(q)) ||
          c.description.toLowerCase().includes(q) ||
          (c.title ?? '').toLowerCase().includes(q) ||
          c.packages.some((p) => p.toLowerCase().includes(q)),
      )
      .sort((a, b) => riskScore(b) - riskScore(a))
  }, [records, severities, sources, kevOnly, minEpss, search])
}
