export interface AppInventoryEntry {
  tecnologia: string
  framework: string
  'base de datos': string[]
  librerias: string[]
}

export interface AppsConfig {
  apps: Record<string, AppInventoryEntry>
}

export interface AppOption {
  id: string
  label: string
  entry: AppInventoryEntry
}

export function isAppsConfig(value: unknown): value is AppsConfig {
  if (!value || typeof value !== 'object') return false
  const candidate = value as AppsConfig
  if (!candidate.apps || typeof candidate.apps !== 'object' || Array.isArray(candidate.apps)) {
    return false
  }
  return Object.values(candidate.apps).every((entry) =>
    Boolean(
      entry
      && typeof entry.tecnologia === 'string'
      && typeof entry.framework === 'string'
      && Array.isArray(entry['base de datos'])
      && Array.isArray(entry.librerias),
    ),
  )
}

export function toAppOptions(config: AppsConfig): AppOption[] {
  return Object.entries(config.apps)
    .map(([label, entry]) => ({
      id: slugifyAppId(label),
      label,
      entry,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'es'))
}

export function slugifyAppId(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const EMPTY_APPS_CONFIG: AppsConfig = { apps: {} }
