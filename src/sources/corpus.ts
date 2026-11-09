import type { CorpusHealthResponse, CorpusSnapshot } from '../corpus/types'

export type { CorpusHealthResponse, CorpusSnapshot }

export async function fetchCorpus(signal?: AbortSignal): Promise<CorpusSnapshot> {
  const response = await fetch('/api/corpus', { signal })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `Corpus HTTP ${response.status}`)
  }
  return response.json() as Promise<CorpusSnapshot>
}

export async function fetchCorpusHealth(signal?: AbortSignal): Promise<CorpusHealthResponse> {
  const response = await fetch('/api/corpus/health', { signal })
  if (!response.ok) {
    throw new Error(`Corpus health HTTP ${response.status}`)
  }
  return response.json() as Promise<CorpusHealthResponse>
}

export async function refreshCorpus(signal?: AbortSignal): Promise<CorpusSnapshot> {
  const response = await fetch('/api/corpus/refresh', {
    method: 'POST',
    signal,
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `Corpus refresh HTTP ${response.status}`)
  }
  return response.json() as Promise<CorpusSnapshot>
}
