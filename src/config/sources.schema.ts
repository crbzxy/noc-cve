export type SourceRole = 'list' | 'enrich' | 'score' | 'match'

export interface SourceConfig {
  id: string
  label: string
  enabled: boolean
  role: SourceRole
  proxyPrefix: string
  baseUrl: string
  path: string
  authEnv?: string
  /** Si true, sin process.env[authEnv] la fuente queda off (no se llama al upstream). */
  authRequired?: boolean
}

export type TechnologyCategory = 'language' | 'framework'

/** IDs de fuentes en `sources` que respaldan vulnerabilidades de esta tecnología. */
export type TruthSourceId =
  | 'nvd'
  | 'cveorg'
  | 'github'
  | 'osv'
  | 'wordfence'
  | 'euvd'
  | 'kev'
  | 'vulncheck-kev'
  | 'epss'

export interface TechnologyConfig {
  id: string
  label: string
  keywords: string[]
  /**
   * Fuentes de verdad de vulnerabilidades para esta tecnología (metadato ops/UI).
   * No cambia el matching por keywords; documenta qué upstreams la cubren.
   */
  truthSources?: TruthSourceId[]
  /**
   * Metadato de catálogo (ops / docs). No alimenta matching ni UI actual.
   * reserved for future relation views.
   */
  related?: string[]
  /** Metadato de catálogo language/framework. */
  category?: TechnologyCategory
  /** Metadato de plataforma central en el catálogo. */
  hub?: boolean
  /** Nivel 1: área vigilada (TEL). */
  group?: string
  /** Nivel 2: stack TEL o categoría empresarial. */
  subgroup?: string
}

/** Paquete vigilado para cruces OSV (ecosystem + name; version opcional = cualquier versión afectada). */
export interface WatchedPackage {
  ecosystem: string
  name: string
  /** Si falta, OSV responde con vulns conocidas del paquete (sin afirmar versión exacta). */
  version?: string
}

export interface SourcesDefaults {
  sortBy: 'risk' | 'severity' | 'cvss' | 'epss' | 'published'
  sortDir: 'asc' | 'desc'
}

export interface AppSourcesConfig {
  sources: SourceConfig[]
  technologies: TechnologyConfig[]
  defaults: SourcesDefaults
  watchedPackages?: WatchedPackage[]
}

const CORE_SOURCES: SourceConfig[] = [
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
]

const TRUTH_SOURCES: SourceConfig[] = [
  {
    id: 'cveorg',
    label: 'CVE.org (Search API)',
    enabled: true,
    role: 'list',
    proxyPrefix: '/api/cveorg',
    baseUrl: 'https://www.cve.org',
    path: '/restapiv1/search',
  },
  {
    id: 'osv',
    label: 'OSV.dev',
    enabled: true,
    role: 'match',
    proxyPrefix: '/api/osv',
    baseUrl: 'https://api.osv.dev',
    path: '/v1',
  },
  {
    id: 'euvd',
    label: 'ENISA EUVD',
    enabled: true,
    role: 'enrich',
    proxyPrefix: '/api/euvd',
    baseUrl: 'https://euvdservices.enisa.europa.eu',
    path: '/api/search',
  },
  {
    id: 'vulncheck-kev',
    label: 'VulnCheck KEV',
    enabled: true,
    role: 'enrich',
    proxyPrefix: '/api/vckev',
    baseUrl: 'https://api.vulncheck.com',
    path: '/v3/index/vulncheck-kev',
    authEnv: 'VULNCHECK_TOKEN',
    authRequired: true,
  },
  {
    id: 'wordfence',
    label: 'Wordfence Intelligence',
    enabled: true,
    role: 'list',
    proxyPrefix: '/api/wordfence',
    baseUrl: 'https://www.wordfence.com',
    path: '/api/intelligence/v3/vulnerabilities/production',
    authEnv: 'WORDFENCE_API_KEY',
    authRequired: true,
  },
]

export const FALLBACK_SOURCES_CONFIG: AppSourcesConfig = {
  sources: [...CORE_SOURCES, ...TRUTH_SOURCES],
  technologies: [],
  watchedPackages: [],
  defaults: { sortBy: 'risk', sortDir: 'desc' },
}

function isWatchedPackage(value: unknown): value is WatchedPackage {
  if (!value || typeof value !== 'object') return false
  const pkg = value as WatchedPackage
  const versionOk = pkg.version == null || typeof pkg.version === 'string'
  return typeof pkg.ecosystem === 'string'
    && typeof pkg.name === 'string'
    && versionOk
}

export function isAppSourcesConfig(value: unknown): value is AppSourcesConfig {
  if (!value || typeof value !== 'object') return false
  const candidate = value as AppSourcesConfig
  if (!Array.isArray(candidate.sources) || !Array.isArray(candidate.technologies) || !candidate.defaults) {
    return false
  }
  if (candidate.watchedPackages != null && !Array.isArray(candidate.watchedPackages)) return false
  if (candidate.watchedPackages?.some((pkg) => !isWatchedPackage(pkg))) return false
  const sortBy = candidate.defaults.sortBy
  const sortDir = candidate.defaults.sortDir
  const sortByOk = sortBy === 'risk' || sortBy === 'severity' || sortBy === 'cvss'
    || sortBy === 'epss' || sortBy === 'published'
  const sortDirOk = sortDir === 'asc' || sortDir === 'desc'
  if (!sortByOk || !sortDirOk) return false
  return candidate.sources.every((source) =>
    Boolean(source && typeof source.id === 'string' && typeof source.label === 'string'
      && typeof source.proxyPrefix === 'string'
      && typeof source.baseUrl === 'string'
      && source.baseUrl.startsWith('https://')))
    && candidate.technologies.every((tech) => {
      if (!tech || typeof tech.id !== 'string' || typeof tech.label !== 'string'
        || !Array.isArray(tech.keywords)) {
        return false
      }
      if (tech.truthSources == null) return true
      return Array.isArray(tech.truthSources)
        && tech.truthSources.every((sourceId) => typeof sourceId === 'string')
    })
}

export function findSource(config: AppSourcesConfig, id: string): SourceConfig | undefined {
  return config.sources.find((source) => source.id === id)
}
