import { EMPTY_APPS_CONFIG, isAppsConfig, type AppsConfig } from './apps.schema'

const CONFIG_URL = '/config/apps.json'

export async function loadAppsConfig(signal?: AbortSignal): Promise<AppsConfig> {
  try {
    const response = await fetch(CONFIG_URL, { signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data: unknown = await response.json()
    if (!isAppsConfig(data)) throw new Error('Formato de apps.json inválido')
    return data
  } catch (error) {
    if (signal?.aborted) throw error
    console.warn('No se pudo cargar apps.json; sin inventario de aplicaciones.', error)
    return EMPTY_APPS_CONFIG
  }
}
