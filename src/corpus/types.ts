import type { CveRecord } from '../types'

export interface CorpusSourceHealth {
  id: string
  label: string
  status: 'ok' | 'error' | 'off'
  count?: number
  error?: string
  updatedAt?: number
}

export interface CorpusSnapshot {
  generatedAt: number
  windowDays: number
  records: CveRecord[]
  sources: CorpusSourceHealth[]
  ingestMs: number
  /** CRITICAL presentes en este snapshot. */
  criticalIds: string[]
  /** CRITICAL nuevos respecto al snapshot anterior. */
  newCriticalIds: string[]
}

export interface CorpusHealthResponse {
  status: 'idle' | 'loading' | 'ready' | 'error'
  generatedAt: number | null
  windowDays: number
  recordCount: number
  ingestMs: number | null
  sources: CorpusSourceHealth[]
  newCriticalIds: string[]
  error?: string
}
