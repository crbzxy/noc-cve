import { getJson } from '../lib/http'
import type { EpssInfo } from '../types'

// FIRST EPSS — probabilidad de explotación en los próximos 30 días.
// https://www.first.org/epss/api — se consulta en lotes de CVE IDs separados por coma.

interface EpssResponse {
  data: { cve: string; epss: string; percentile: string; date: string }[]
}

const BATCH = 100
const CONCURRENCY = 4

export async function fetchEpss(ids: string[], signal?: AbortSignal): Promise<Map<string, EpssInfo>> {
  const cves = ids.filter((id) => id.startsWith('CVE-'))
  const batches: string[][] = []
  for (let i = 0; i < cves.length; i += BATCH) batches.push(cves.slice(i, i + BATCH))

  const result = new Map<string, EpssInfo>()
  let cursor = 0
  async function worker() {
    while (cursor < batches.length) {
      const batch = batches[cursor++]
      const { data } = await getJson<EpssResponse>(
        `/api/epss?limit=${BATCH}&cve=${batch.join(',')}`,
        signal,
      )
      for (const row of data.data) {
        result.set(row.cve, { score: Number(row.epss), percentile: Number(row.percentile) })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker))
  return result
}
