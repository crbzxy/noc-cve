export function getSnapshot(): unknown
export function getHealth(): {
  status: string
  generatedAt: number | null
  windowDays: number
  recordCount: number
  ingestMs: number | null
  sources: unknown[]
  newCriticalIds: string[]
  error?: string
}
export function refreshCorpus(force?: boolean): Promise<unknown>
export function startCorpusWorker(options?: {
  apiBase?: string
  startTimer?: boolean
  ingestOnBoot?: boolean
}): Promise<void>
export function stopCorpusWorker(): void
