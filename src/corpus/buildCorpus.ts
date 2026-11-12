import {
  findSource,
  type AppSourcesConfig,
  type SourceConfig,
} from '../config/sources.schema'
import { aggregate } from '../lib/aggregate'
import { CORPUS_WINDOW_DAYS } from '../lib/corpusWindow'
import { applyTechnologyTags } from '../lib/matchTechnologies'
import { fetchCircl } from '../sources/circl'
import { fetchCveOrg } from '../sources/cveorg'
import { fetchEuvd } from '../sources/euvd'
import { fetchGithub } from '../sources/github'
import { fetchKev, type KevCatalog } from '../sources/kev'
import { fetchNvd } from '../sources/nvd'
import { fetchRedHat } from '../sources/redhat'
import { fetchVulncheckKev, type VulncheckKevCatalog } from '../sources/vulncheckKev'
import { fetchWordfence } from '../sources/wordfence'
import type { CveRecord, PartialCve } from '../types'
import type { CorpusSnapshot, CorpusSourceHealth } from './types'

/** Solo corre en Node (bundle de ingest); tsconfig.app no carga @types/node. */
declare const process: { env: Record<string, string | undefined> }

function missingAuthReason(source: SourceConfig | undefined): string | undefined {
  if (!source?.authRequired || !source.authEnv) return undefined
  const value = process.env[source.authEnv]
  if (value && value.length > 0) return undefined
  return `sin token en .env (${source.authEnv})`
}

/** Activa solo si enabled y, si authRequired, hay token en env. */
function sourceRunState(config: AppSourcesConfig, id: string): {
  active: boolean
  offReason?: string
} {
  const source = findSource(config, id)
  if (source?.enabled === false) {
    return { active: false, offReason: 'desactivada en config/sources.json' }
  }
  const authGap = missingAuthReason(source)
  if (authGap) return { active: false, offReason: authGap }
  return { active: true }
}

const CONSUMO_ERROR_MAX = 180

function shortError(message: string): string {
  const compact = message.replace(/\s+/g, ' ').trim()
  if (compact.length <= CONSUMO_ERROR_MAX) return compact
  return `${compact.slice(0, CONSUMO_ERROR_MAX)}…`
}

/** Una línea por fuente y ciclo de ingesta (~cada 5 min). No loguea cada request HTTP. */
function logSourceConsumo(input: {
  label: string
  enabled: boolean
  count?: number
  error?: string
  ms?: number
  offReason?: string
}) {
  if (!input.enabled) {
    console.log(
      `[consumo] ${input.label} · omitida · ${input.offReason ?? 'motivo desconocido'}`,
    )
    return
  }
  if (input.error) {
    console.error(
      `[consumo] ${input.label} · falló · ${shortError(input.error)}`
      + (input.ms != null ? ` · ${input.ms} ms` : ''),
    )
    return
  }
  console.log(
    `[consumo] ${input.label} · ok · ${input.count ?? 0} registros`
    + (input.ms != null ? ` · ${input.ms} ms` : ''),
  )
}

async function settleList(
  id: string,
  label: string,
  runState: { active: boolean; offReason?: string },
  run: () => Promise<PartialCve[]>,
): Promise<{
  id: string
  label: string
  enabled: boolean
  list: PartialCve[]
  error?: string
  offReason?: string
}> {
  if (!runState.active) {
    logSourceConsumo({ label, enabled: false, offReason: runState.offReason })
    return { id, label, enabled: false, list: [], offReason: runState.offReason }
  }
  const started = Date.now()
  try {
    const list = await run()
    logSourceConsumo({ label, enabled: true, count: list.length, ms: Date.now() - started })
    return { id, label, enabled: true, list }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logSourceConsumo({ label, enabled: true, error: message, ms: Date.now() - started })
    return { id, label, enabled: true, list: [], error: message }
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
  const circlMeta = findSource(config, 'circl')
  const redhatMeta = findSource(config, 'redhat')
  const wordfenceMeta = findSource(config, 'wordfence')
  const euvdMeta = findSource(config, 'euvd')
  const kevMeta = findSource(config, 'kev')
  const vulncheckMeta = findSource(config, 'vulncheck-kev')

  const [nvd, github, cveorg, circl, redhat, wordfence, euvd] = await Promise.all([
    settleList('nvd', nvdMeta?.label ?? 'NVD', sourceRunState(config, 'nvd'), () => fetchNvd(days, options.signal)),
    settleList('github', ghMeta?.label ?? 'GitHub', sourceRunState(config, 'github'), () => fetchGithub(days, options.signal)),
    settleList('cveorg', cveorgMeta?.label ?? 'CVE.org', sourceRunState(config, 'cveorg'), () => fetchCveOrg(days, options.signal)),
    settleList('circl', circlMeta?.label ?? 'CIRCL', sourceRunState(config, 'circl'), () => fetchCircl(days, options.signal)),
    settleList('redhat', redhatMeta?.label ?? 'Red Hat', sourceRunState(config, 'redhat'), () => fetchRedHat(days, options.signal)),
    settleList('wordfence', wordfenceMeta?.label ?? 'Wordfence', sourceRunState(config, 'wordfence'), () => fetchWordfence(days, options.signal)),
    settleList('euvd', euvdMeta?.label ?? 'EUVD', sourceRunState(config, 'euvd'), () => fetchEuvd(days, options.signal)),
  ])

  const kevLabel = kevMeta?.label ?? 'CISA KEV'
  const kevState = sourceRunState(config, 'kev')
  let kev: KevCatalog | undefined
  let kevError: string | undefined
  let kevCount: number | undefined
  let kevActive = false
  if (kevState.active) {
    kevActive = true
    const kevStarted = Date.now()
    try {
      kev = await fetchKev(options.signal)
      kevCount = kev.byId.size
      logSourceConsumo({ label: kevLabel, enabled: true, count: kevCount, ms: Date.now() - kevStarted })
    } catch (error) {
      kevError = error instanceof Error ? error.message : String(error)
      logSourceConsumo({ label: kevLabel, enabled: true, error: kevError, ms: Date.now() - kevStarted })
    }
  } else {
    logSourceConsumo({ label: kevLabel, enabled: false, offReason: kevState.offReason })
  }
  const kevOffReason = kevActive ? undefined : kevState.offReason

  const vulncheckLabel = vulncheckMeta?.label ?? 'VulnCheck KEV'
  const vulncheckState = sourceRunState(config, 'vulncheck-kev')
  let vulncheckKev: VulncheckKevCatalog | undefined
  let vulncheckError: string | undefined
  let vulncheckCount: number | undefined
  let vulncheckActive = false
  if (vulncheckState.active) {
    vulncheckActive = true
    const vulncheckStarted = Date.now()
    try {
      vulncheckKev = await fetchVulncheckKev(options.signal)
      vulncheckCount = vulncheckKev.byId.size
      logSourceConsumo({
        label: vulncheckLabel,
        enabled: true,
        count: vulncheckCount,
        ms: Date.now() - vulncheckStarted,
      })
    } catch (error) {
      vulncheckError = error instanceof Error ? error.message : String(error)
      logSourceConsumo({
        label: vulncheckLabel,
        enabled: true,
        error: vulncheckError,
        ms: Date.now() - vulncheckStarted,
      })
    }
  } else {
    logSourceConsumo({
      label: vulncheckLabel,
      enabled: false,
      offReason: vulncheckState.offReason,
    })
  }
  const vulncheckOffReason = vulncheckActive ? undefined : vulncheckState.offReason

  const updatedAt = Date.now()
  const aggregated = aggregate({
    days,
    lists: [nvd.list, github.list, cveorg.list, circl.list, redhat.list, wordfence.list, euvd.list],
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
      error: nvd.error ?? nvd.offReason,
      updatedAt: nvd.enabled && !nvd.error ? updatedAt : undefined,
    },
    {
      id: 'github',
      label: github.label,
      status: !github.enabled ? 'off' : github.error ? 'error' : 'ok',
      count: github.enabled ? github.list.length : undefined,
      error: github.error ?? github.offReason,
      updatedAt: github.enabled && !github.error ? updatedAt : undefined,
    },
    {
      id: 'cveorg',
      label: cveorg.label,
      status: !cveorg.enabled ? 'off' : cveorg.error ? 'error' : 'ok',
      count: cveorg.enabled ? cveorg.list.length : undefined,
      error: cveorg.error ?? cveorg.offReason,
      updatedAt: cveorg.enabled && !cveorg.error ? updatedAt : undefined,
    },
    {
      id: 'circl',
      label: circl.label,
      status: !circl.enabled ? 'off' : circl.error ? 'error' : 'ok',
      count: circl.enabled ? circl.list.length : undefined,
      error: circl.error ?? circl.offReason,
      updatedAt: circl.enabled && !circl.error ? updatedAt : undefined,
    },
    {
      id: 'redhat',
      label: redhat.label,
      status: !redhat.enabled ? 'off' : redhat.error ? 'error' : 'ok',
      count: redhat.enabled ? redhat.list.length : undefined,
      error: redhat.error ?? redhat.offReason,
      updatedAt: redhat.enabled && !redhat.error ? updatedAt : undefined,
    },
    {
      id: 'wordfence',
      label: wordfence.label,
      status: !wordfence.enabled ? 'off' : wordfence.error ? 'error' : 'ok',
      count: wordfence.enabled ? wordfence.list.length : undefined,
      error: wordfence.error ?? wordfence.offReason,
      updatedAt: wordfence.enabled && !wordfence.error ? updatedAt : undefined,
    },
    {
      id: 'euvd',
      label: euvd.label,
      status: !euvd.enabled ? 'off' : euvd.error ? 'error' : 'ok',
      count: euvd.enabled ? euvd.list.length : undefined,
      error: euvd.error ?? euvd.offReason,
      updatedAt: euvd.enabled && !euvd.error ? updatedAt : undefined,
    },
    {
      id: 'kev',
      label: kevMeta?.label ?? 'KEV',
      status: !kevActive ? 'off' : kevError ? 'error' : 'ok',
      count: kevCount,
      error: kevError ?? kevOffReason,
      updatedAt: kev && !kevError ? updatedAt : undefined,
    },
    {
      id: 'vulncheck-kev',
      label: vulncheckMeta?.label ?? 'VulnCheck KEV',
      status: !vulncheckActive ? 'off' : vulncheckError ? 'error' : 'ok',
      count: vulncheckCount,
      error: vulncheckError ?? vulncheckOffReason,
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
