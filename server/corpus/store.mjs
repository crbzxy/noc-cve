// Snapshot canónico del corpus CVE (memoria + archivo opcional).
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { installDirectCorpusFetch } from './directFetch.mjs'

const rootDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolveProjectRoot(rootDir)
const dataDir = join(projectRoot, 'data')
const snapshotPath = join(dataDir, 'corpus.json')

/** Vite puede cargar este módulo desde `.vite-temp`; no confiar solo en import.meta.url. */
function resolveProjectRoot(moduleDir) {
  const fromModule = join(moduleDir, '..', '..')
  if (existsSync(join(fromModule, 'package.json'))) return fromModule
  const fromCwd = process.cwd()
  if (existsSync(join(fromCwd, 'package.json'))) return fromCwd
  return fromModule
}

function resolveIngestBundleUrl() {
  const candidates = [
    join(rootDir, 'ingest.bundle.mjs'),
    join(projectRoot, 'server', 'corpus', 'ingest.bundle.mjs'),
    join(process.cwd(), 'server', 'corpus', 'ingest.bundle.mjs'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return pathToFileURL(candidate).href
  }
  throw new Error(
    'No está ingest.bundle.mjs. Ejecuta `npm run bundle:corpus` (o predev/prestart) en el servidor.',
  )
}

const REFRESH_MS = Number(process.env.CORPUS_REFRESH_MS ?? 5 * 60_000)
const WINDOW_DAYS = 90

/** @type {{
 *  status: 'idle' | 'loading' | 'ready' | 'error'
 *  snapshot: null | object
 *  error: string | null
 *  inflight: null | Promise<object>
 *  timer: null | ReturnType<typeof setInterval>
 *  apiBase: string
 * }} */
const state = {
  status: 'idle',
  snapshot: null,
  error: null,
  inflight: null,
  timer: null,
  apiBase: '',
}

async function loadPersisted() {
  try {
    const raw = await readFile(snapshotPath, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && Array.isArray(parsed.records) && parsed.records.length > 0) {
      state.snapshot = parsed
      state.status = 'ready'
      state.error = null
      console.log(`[corpus] Hidratado desde disco · ${parsed.records.length} registros`)
    }
  } catch {
    // sin snapshot previo
  }
}

async function persist(snapshot) {
  try {
    await mkdir(dataDir, { recursive: true })
    await writeFile(snapshotPath, JSON.stringify(snapshot), 'utf8')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[corpus] No se pudo persistir snapshot: ${message}`)
  }
}

async function runIngest(force = false) {
  if (state.inflight) return state.inflight

  state.inflight = (async () => {
    state.status = state.snapshot ? 'ready' : 'loading'
    state.error = null

    // Fetch directo a upstreams (sin loopback al propio Vite/server).
    const internalOrigin = installDirectCorpusFetch()
    process.env.CORPUS_API_BASE = internalOrigin
    state.apiBase = internalOrigin

    const previousCriticalIds = Array.isArray(state.snapshot?.criticalIds)
      ? state.snapshot.criticalIds
      : []

    try {
      const { runIngest: ingest } = await import(resolveIngestBundleUrl())
      const snapshot = await ingest(previousCriticalIds)
      state.snapshot = snapshot
      state.status = 'ready'
      state.error = null
      await persist(snapshot)
      console.log(
        `[corpus] Listo · ${snapshot.records.length} CVE · ${snapshot.ingestMs} ms`
        + (snapshot.newCriticalIds?.length
          ? ` · +${snapshot.newCriticalIds.length} CRITICAL nuevos`
          : ''),
      )
      return snapshot
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      state.error = message
      if (!state.snapshot) state.status = 'error'
      console.error(`[corpus] Ingesta fallida: ${message}`)
      if (force && !state.snapshot) throw error
      return state.snapshot
    } finally {
      state.inflight = null
    }
  })()

  return state.inflight
}

export function getSnapshot() {
  return state.snapshot
}

export function getHealth() {
  const snapshot = state.snapshot
  return {
    status: state.status,
    generatedAt: snapshot?.generatedAt ?? null,
    windowDays: snapshot?.windowDays ?? WINDOW_DAYS,
    recordCount: snapshot?.records?.length ?? 0,
    ingestMs: snapshot?.ingestMs ?? null,
    sources: snapshot?.sources ?? [],
    newCriticalIds: snapshot?.newCriticalIds ?? [],
    error: state.error ?? undefined,
  }
}

export async function refreshCorpus(force = true) {
  return runIngest(force)
}

/**
 * @param {{ apiBase?: string, startTimer?: boolean, ingestOnBoot?: boolean }} options
 */
export async function startCorpusWorker(options = {}) {
  // apiBase legacy ignorado: siempre fetch directo.
  void options.apiBase
  await loadPersisted()

  if (options.ingestOnBoot !== false) {
    void runIngest(false)
  }

  if (options.startTimer !== false && REFRESH_MS > 0) {
    if (state.timer) clearInterval(state.timer)
    state.timer = setInterval(() => {
      void runIngest(false)
    }, REFRESH_MS)
    if (typeof state.timer.unref === 'function') state.timer.unref()
  }
}

export function stopCorpusWorker() {
  if (state.timer) {
    clearInterval(state.timer)
    state.timer = null
  }
}
