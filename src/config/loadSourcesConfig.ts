import {
  FALLBACK_SOURCES_CONFIG,
  isAppSourcesConfig,
  type AppSourcesConfig,
} from './sources.schema'
import { toRequestUrl } from '../lib/requestUrl'

const CONFIG_URL = '/config/sources.json'

export async function loadSourcesConfig(signal?: AbortSignal): Promise<AppSourcesConfig> {
  try {
    const response = await fetch(toRequestUrl(CONFIG_URL), { signal })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const data: unknown = await response.json()
    if (!isAppSourcesConfig(data)) {
      throw new Error('Formato de sources.json inválido')
    }
    return {
      sources: data.sources,
      technologies: data.technologies,
      defaults: {
        sortBy: data.defaults.sortBy === 'risk' || data.defaults.sortBy === 'severity'
          || data.defaults.sortBy === 'cvss' || data.defaults.sortBy === 'epss'
          || data.defaults.sortBy === 'published'
          ? data.defaults.sortBy
          : 'risk',
        sortDir: data.defaults.sortDir === 'asc' ? 'asc' : 'desc',
      },
    }
  } catch (error) {
    if (signal?.aborted) throw error
    console.warn('No se pudo cargar sources.json; usando fallback embebido.', error)
    return FALLBACK_SOURCES_CONFIG
  }
}
