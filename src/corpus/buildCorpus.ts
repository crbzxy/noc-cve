import {
  findSource,
  type AppSourcesConfig,
} from '../config/sources.schema'
import { aggregate } from '../lib/aggregate'
import { CORPUS_WINDOW_DAYS } from '../lib/corpusWindow'
import { applyTechnologyTags } from '../lib/matchTechnologies'
import { fetchCveOrg } from '../sources/cveorg'
import { fetchEuvd } from '../sources/euvd'
import { fetchGithub } from '../sources/github'
import { fetchKev, type KevCatalog } from '../sources/kev'
import { fetchNvd } from '../sources/nvd'
import { fetchVulncheckKev, type VulncheckKevCatalog } from '../sources/vulncheckKev'
import { fetchWordfence } from '../sources/wordfence'
import type { CveRecord, PartialCve } from '../types'
import type { CorpusSnapshot, CorpusSourceHealth } from './types'

function sourceEnabled(config: AppSourcesConfig, id: string): boolean {
  return findSource(config, id)?.enabled !== false
}

async function settleList(
  id: string,
  label: string,
  enabled: boolean,
  run: () => Promise<PartialCve[]>,
): Promise<{ id: string; label: string; enabled: boolean; list: PartialCve[]; error?: string }> {
  if (!enabled) return { id, label, enabled, list: [] }
  try {
    const list = await run()
    return { id, label, enabled, list }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { id, label, enabled, list: [], error: message }
  }
}

function criticalIdsOf(records: CveRecord[]): string[] {
  return records.filter((record) => record.severity === 'CRITICAL').map((record) => record.id)
}

export interface BuildCorpusOptions {
  config: AppSourcesConfig
  previousCriticalIds?: string[]
  signal?: AbortSignal
}

/**
 * Ingesta canónica 90d + taggeo de tecnologías.
 * Pensado para correr en el worker Node (vía bundle) detrás de /api/corpus.
 */
export async function buildCorpus(options: BuildCorpusOptions): Promise<CorpusSnapshot> {
  const started = Date.now()
  const { config } = options
  const days = CORPUS_WINDOW_DAYS

  const nvdMeta = findSource(config, 'nvd')
  const ghMeta = findSource(config, 'github')
  const cveorgMeta = findSource(config, 'cveorg')
  const wordfenceMeta = findSource(config, 'wordfence')
  const euvdMeta = findSource(config, 'euvd')
  const kevMeta = findSource(config, 'kev')
  const vulncheckMeta = findSource(config, 'vulncheck-kev')

  const [nvd, github, cveorg, wordfence, euvd] = await Promise.all([
    settleList('nvd', nvdMeta?.label ?? 'NVD', sourceEnabled(config, 'nvd'), () => fetchNvd(days, options.signal)),
    settleList('github', ghMeta?.label ?? 'GitHub', sourceEnabled(config, 'github'), () => fetchGithub(days, options.signal)),
    settleList('cveorg', cveorgMeta?.label ?? 'CVE.org', sourceEnabled(config, 'cveorg'), () => fetchCveOrg(days, options.signal)),
    settleList('wordfence', wordfenceMeta?.label ?? 'Wordfence', sourceEnabled(config, 'wordfence'), () => fetchWordfence(days, options.signal)),
    settleList('euvd', euvdMeta?.label ?? 'EUVD', sourceEnabled(config, 'euvd'), () => fetchEuvd(days, options.signal)),
  ])

  let kev: KevCatalog | undefined
  let kevError: string | undefined
  let kevCount: number | undefined
  if (sourceEnabled(config, 'kev')) {
    try {
      kev = await fetchKev(options.signal)
      kevCount = kev.byId.size
    } catch (error) {
      kevError = error instanceof Error ? error.message : String(error)
    }
  }

  let vulncheckKev: VulncheckKevCatalog | undefined
  let vulncheckError: string | undefined
  let vulncheckCount: number | undefined
  if (sourceEnabled(config, 'vulncheck-kev')) {
    try {
      vulncheckKev = await fetchVulncheckKev(options.signal)
      vulncheckCount = vulncheckKev.byId.size
    } catch (error) {
      vulncheckError = error instanceof Error ? error.message : String(error)
    }
  }

  const updatedAt = Date.now()
  const aggregated = aggregate({
    days,
    lists: [nvd.list, github.list, cveorg.list, wordfence.list, euvd.list],
    kev,
    vulncheckKev,
  })

  const records = applyTechnologyTags(aggregated, config.technologies)
  const criticalIds = criticalIdsOf(records)
  const previous = new Set(options.previousCriticalIds ?? [])
  const newCriticalIds = previous.size === 0
    ? []
    : criticalIds.filter((id) => !previous.has(id))

  const sources: CorpusSourceHealth[] = [
    {
      id: 'nvd',
      label: nvd.label,
      status: !nvd.enabled ? 'off' : nvd.error ? 'error' : 'ok',
      count: nvd.enabled ? nvd.list.length : undefined,
      error: nvd.error,
      updatedAt: nvd.enabled && !nvd.error ? updatedAt : undefined,
    },
    {
      id: 'github',
      label: github.label,
      status: !github.enabled ? 'off' : github.error ? 'error' : 'ok',
      count: github.enabled ? github.list.length : undefined,
      error: github.error,
      updatedAt: github.enabled && !github.error ? updatedAt : undefined,
    },
    {
      id: 'cveorg',
      label: cveorg.label,
      status: !cveorg.enabled ? 'off' : cveorg.error ? 'error' : 'ok',
      count: cveorg.enabled ? cveorg.list.length : undefined,
      error: cveorg.error,
      updatedAt: cveorg.enabled && !cveorg.error ? updatedAt : undefined,
    },
    {
      id: 'wordfence',
      label: wordfence.label,
      status: !wordfence.enabled ? 'off' : wordfence.error ? 'error' : 'ok',
      count: wordfence.enabled ? wordfence.list.length : undefined,
      error: wordfence.error,
      updatedAt: wordfence.enabled && !wordfence.error ? updatedAt : undefined,
    },
    {
      id: 'euvd',
      label: euvd.label,
      status: !euvd.enabled ? 'off' : euvd.error ? 'error' : 'ok',
      count: euvd.enabled ? euvd.list.length : undefined,
      error: euvd.error,
      updatedAt: euvd.enabled && !euvd.error ? updatedAt : undefined,
    },
    {
      id: 'kev',
      label: kevMeta?.label ?? 'KEV',
      status: !sourceEnabled(config, 'kev') ? 'off' : kevError ? 'error' : 'ok',
      count: kevCount,
      error: kevError,
      updatedAt: kev && !kevError ? updatedAt : undefined,
    },
    {
      id: 'vulncheck-kev',
      label: vulncheckMeta?.label ?? 'VulnCheck KEV',
      status: !sourceEnabled(config, 'vulncheck-kev') ? 'off' : vulncheckError ? 'error' : 'ok',
      count: vulncheckCount,
      error: vulncheckError,
      updatedAt: vulncheckKev && !vulncheckError ? updatedAt : undefined,
    },
  ]

  return {
    generatedAt: updatedAt,
    windowDays: days,
    records,
    sources,
    ingestMs: Date.now() - started,
    criticalIds,
    newCriticalIds,
  }
}
