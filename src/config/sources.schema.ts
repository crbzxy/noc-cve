export type SourceRole = 'list' | 'enrich' | 'score'

export interface SourceConfig {
  id: string
  label: string
  enabled: boolean
  role: SourceRole
  proxyPrefix: string
  baseUrl: string
  path: string
  authEnv?: string
}

export type TechnologyCategory = 'language' | 'framework'

export interface TechnologyConfig {
  id: string
  label: string
  keywords: string[]
  /** Ids de otras tecnologías relacionadas (catálogo / proveedor). */
  related?: string[]
  /** Incluir en el ranking de lenguajes / frameworks. */
  category?: TechnologyCategory
  /** Marca de plataforma central en el catálogo (ej. SAP, LAMP). */
  hub?: boolean
}

export interface SourcesDefaults {
  stackOnly: boolean
  sortBy: 'risk' | 'severity' | 'cvss' | 'epss' | 'published'
  sortDir: 'asc' | 'desc'
}

export interface AppSourcesConfig {
  sources: SourceConfig[]
  technologies: TechnologyConfig[]
  defaults: SourcesDefaults
}

export const FALLBACK_SOURCES_CONFIG: AppSourcesConfig = {
  sources: [
    {
      id: 'nvd',
      label: 'NVD (NIST)',
      enabled: true,
      role: 'list',
      proxyPrefix: '/api/nvd',
      baseUrl: 'https://services.nvd.nist.gov',
      path: '/rest/json/cves/2.0',
      authEnv: 'NVD_API_KEY',
    },
    {
      id: 'github',
      label: 'GitHub Advisories',
      enabled: true,
      role: 'list',
      proxyPrefix: '/api/github',
      baseUrl: 'https://api.github.com',
      path: '/advisories',
      authEnv: 'GITHUB_TOKEN',
    },
    {
      id: 'kev',
      label: 'CISA KEV',
      enabled: true,
      role: 'enrich',
      proxyPrefix: '/api/kev',
      baseUrl: 'https://www.cisa.gov',
      path: '/sites/default/files/feeds/known_exploited_vulnerabilities.json',
    },
    {
      id: 'epss',
      label: 'FIRST EPSS',
      enabled: true,
      role: 'score',
      proxyPrefix: '/api/epss',
      baseUrl: 'https://api.first.org',
      path: '/data/v1/epss',
    },
  ],
  technologies: [],
  defaults: { stackOnly: true, sortBy: 'risk', sortDir: 'desc' },
}

export function isAppSourcesConfig(value: unknown): value is AppSourcesConfig {
  if (!value || typeof value !== 'object') return false
  const candidate = value as AppSourcesConfig
  return Array.isArray(candidate.sources) && Array.isArray(candidate.technologies) && Boolean(candidate.defaults)
}

export function listSourceIds(config: AppSourcesConfig): string[] {
  return config.sources.filter((source) => source.role !== 'score').map((source) => source.id)
}

export function findSource(config: AppSourcesConfig, id: string): SourceConfig | undefined {
  return config.sources.find((source) => source.id === id)
}
