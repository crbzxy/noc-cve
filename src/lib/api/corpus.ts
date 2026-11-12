import type { CorpusHealthResponse, CorpusSnapshot } from '@/corpus/types'
import { apiGet, apiPost } from './client'

export async function fetchCorpus(signal?: AbortSignal): Promise<CorpusSnapshot> {
  const { data } = await apiGet<CorpusSnapshot>('/api/corpus', signal)
  return data
}

export async function fetchCorpusHealth(signal?: AbortSignal): Promise<CorpusHealthResponse> {
  const { data } = await apiGet<CorpusHealthResponse>('/api/corpus/health', signal)
  return data
}

export async function refreshCorpus(signal?: AbortSignal): Promise<CorpusSnapshot> {
  const { data } = await apiPost<CorpusSnapshot>('/api/corpus/refresh', undefined, signal)
  return data
}
