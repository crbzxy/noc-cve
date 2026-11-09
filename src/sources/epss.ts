import { getJson, HttpError } from '../lib/http'
import type { EpssInfo } from '../types'

// FIRST EPSS — lotes acotados; el hook ya limita cuántos CVE se consultan.

interface EpssResponse {
  data: { cve: string; epss: string; percentile: string; date: string }[]
}

const BATCH = 40
const CONCURRENCY = 2

/** Consulta EPSS por lotes; un lote fallido no tumba el resto. */
export async function fetchEpss(ids: string[], signal?: AbortSignal): Promise<Map<string, EpssInfo>> {
  const cves = ids.filter((id) => id.startsWith('CVE-'))
  const batches: string[][] = []
  for (let i = 0; i < cves.length; i += BATCH) batches.push(cves.slice(i, i + BATCH))

  const result = new Map<string, EpssInfo>()
  if (batches.length === 0) return result

  let cursor = 0
  let failures = 0
  let lastError: unknown

  async function worker() {
    while (cursor < batches.length) {
      const index = cursor
      cursor += 1
      const batch = batches[index]
      try {
        const qs = new URLSearchParams({
          limit: String(BATCH),
          cve: batch.join(','),
        })
        const { data } = await getJson<EpssResponse>(`/api/epss?${qs}`, signal)
        for (const row of data.data ?? []) {
          result.set(row.cve, { score: Number(row.epss), percentile: Number(row.percentile) })
        }
      } catch (error) {
        failures += 1
        lastError = error
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker))

  if (result.size === 0 && failures > 0) {
    if (lastError instanceof HttpError) throw lastError
    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }
  return result
}
