import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  FALLBACK_SOURCES_CONFIG,
  isAppSourcesConfig,
  type AppSourcesConfig,
} from '../config/sources.schema'
import { buildCorpus } from './buildCorpus'
import type { CorpusSnapshot } from './types'

export type { CorpusSnapshot }

function loadConfigFromDisk(): AppSourcesConfig {
  const root = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    join(root, '..', '..', 'config', 'sources.json'),
    join(root, '..', 'config', 'sources.json'),
    join(process.cwd(), 'config', 'sources.json'),
  ]
  for (const path of candidates) {
    try {
      const data: unknown = JSON.parse(readFileSync(path, 'utf8'))
      if (isAppSourcesConfig(data)) {
        return {
          sources: data.sources,
          technologies: data.technologies,
          watchedPackages: data.watchedPackages ?? [],
          defaults: data.defaults,
        }
      }
    } catch {
      // try next
    }
  }
  return FALLBACK_SOURCES_CONFIG
}

export async function runIngest(previousCriticalIds: string[] = []): Promise<CorpusSnapshot> {
  const config = loadConfigFromDisk()
  return buildCorpus({ config, previousCriticalIds })
}
