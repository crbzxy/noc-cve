import type { WatchedPackage } from '../config/sources.schema'
import type { AppInventoryEntry } from '../config/apps.schema'

export type LibraryEcosystem = 'Maven' | 'npm' | 'PyPI' | 'Go' | 'Packagist' | 'WordPress'

export type LibraryTrackKind = 'queryable' | 'internal'

export interface TrackedLibrary {
  raw: string
  /** Nombre corto para UI / cruce textual. */
  displayName: string
  artifactId: string
  groupId?: string
  version?: string
  ecosystem: LibraryEcosystem
  kind: LibraryTrackKind
  needle: string
  /** Agujas extra para cruce textual (p. ej. "magento", "adobe commerce"). */
  textNeedles?: string[]
  /** Clave estable para maps OSV ↔ UI. */
  packageKey: string
  watched?: WatchedPackage
}

export interface ResolvedAppStack {
  /** Runtime + framework + DBs + hints de libs (selector / contexto amplio). */
  techIds: string[]
  /**
   * Runtime + framework (p. ej. php+magento) para el selector de tecnologías.
   * Relación legible: Magento/WordPress ⇒ PHP.
   */
  primaryTechIds: string[]
  /**
   * Frameworks de alcance para filtrar CVEs (sin lenguaje suelto).
   * Evita que "php" meta CVE genéricos de Python/PHP no relacionados al producto.
   */
  scopeTechIds: string[]
  packageNeedles: string[]
  watchedPackages: WatchedPackage[]
  libraries: TrackedLibrary[]
}

/** Frameworks donde el inventario Packagist/WP necesita respaldo por tech. */
const SCOPE_TECH_IDS = new Set(['magento', 'wordpress', 'laravel', 'symfony'])

const RUNTIME_MAP: Array<{ pattern: RegExp; techId: string }> = [
  { pattern: /\bjava\b/i, techId: 'java' },
  { pattern: /\bphp\b/i, techId: 'php' },
]

const FRAMEWORK_MAP: Array<{ pattern: RegExp; techId: string }> = [
  { pattern: /spring/i, techId: 'spring' },
  { pattern: /magento/i, techId: 'magento' },
  { pattern: /wordpress|wp[-\s]?engine/i, techId: 'wordpress' },
  { pattern: /laravel/i, techId: 'laravel' },
  { pattern: /symfony/i, techId: 'symfony' },
]

/** Magento / WordPress / Laravel / Symfony implican PHP en el inventario. */
const FRAMEWORK_IMPLIES_RUNTIME: Record<string, string> = {
  magento: 'php',
  wordpress: 'php',
  laravel: 'php',
  symfony: 'php',
}

const DATABASE_MAP: Array<{ pattern: RegExp; techId: string }> = [
  { pattern: /mongo/i, techId: 'mongodb' },
  { pattern: /redis/i, techId: 'redis' },
  { pattern: /\bsql\b|mssql|sql\s*server/i, techId: 'sqlserver' },
  { pattern: /mysql|mariadb|innodb/i, techId: 'mysql' },
  { pattern: /elasticsearch|opensearch/i, techId: 'elasticsearch' },
  { pattern: /\bsap\b/i, techId: 'sap' },
]

const LIBRARY_TECH_HINTS: Array<{ pattern: RegExp; techId: string }> = [
  { pattern: /rabbit|amqp/i, techId: 'rabbitmq' },
  { pattern: /mqtt/i, techId: 'mqtt' },
  { pattern: /tomcat/i, techId: 'tomcat' },
  { pattern: /prometheus|micrometer-registry-prometheus/i, techId: 'prometheus' },
  { pattern: /mongodb|mongo-java/i, techId: 'mongodb' },
  { pattern: /redis|jedis|jrejson|credis/i, techId: 'redis' },
  { pattern: /mssql|sqlserver/i, techId: 'sqlserver' },
  { pattern: /elasticsearch|opensearch/i, techId: 'elasticsearch' },
  { pattern: /sapjco|\.sap\b|commons-sap/i, techId: 'sap' },
  { pattern: /spring/i, techId: 'spring' },
  { pattern: /magento\//i, techId: 'magento' },
]

/** groupId conocidos cuando el inventario solo trae artifactId_versión. */
const MAVEN_GROUP_BY_ARTIFACT: Record<string, string> = {
  'jackson-databind': 'com.fasterxml.jackson.core',
  'jackson-core': 'com.fasterxml.jackson.core',
  'jackson-annotations': 'com.fasterxml.jackson.core',
  'jackson-jakarta-rs-json-provider': 'com.fasterxml.jackson.jakarta.rs',
  gson: 'com.google.code.gson',
  'commons-collections': 'commons-collections',
  'commons-collections4': 'org.apache.commons',
  'commons-lang': 'commons-lang',
  'commons-lang3': 'org.apache.commons',
  'commons-logging': 'commons-logging',
  'commons-io': 'commons-io',
  'commons-dbcp2': 'org.apache.commons',
  'commons-pool2': 'org.apache.commons',
  'commons-discovery': 'commons-discovery',
  'mssql-jdbc': 'com.microsoft.sqlserver',
  'mongo-java-driver': 'org.mongodb',
  'mongodb-driver-sync': 'org.mongodb',
  'mongodb-driver-core': 'org.mongodb',
  bson: 'org.mongodb',
  jedis: 'redis.clients',
  lettuce: 'io.lettuce',
  'spring-boot-starter-web': 'org.springframework.boot',
  'spring-boot-starter-data-jpa': 'org.springframework.boot',
  'spring-boot-starter-data-mongodb': 'org.springframework.boot',
  'spring-boot-starter-actuator': 'org.springframework.boot',
  'spring-boot-starter-validation': 'org.springframework.boot',
  'spring-boot-starter-test': 'org.springframework.boot',
  'spring-boot-starter-amqp': 'org.springframework.boot',
  'spring-boot-starter-security': 'org.springframework.boot',
  'spring-cloud-starter-openfeign': 'org.springframework.cloud',
  'spring-cloud-starter-netflix-eureka-client': 'org.springframework.cloud',
  'spring-cloud-starter-config': 'org.springframework.cloud',
  'spring-cloud-starter-bootstrap': 'org.springframework.cloud',
  'springdoc-openapi-starter-webmvc-ui': 'org.springdoc',
  'spring-core': 'org.springframework',
  'spring-web': 'org.springframework',
  'spring-context': 'org.springframework',
  poi: 'org.apache.poi',
  'poi-ooxml': 'org.apache.poi',
  log4j: 'log4j',
  'log4j-core': 'org.apache.logging.log4j',
  'log4j-api': 'org.apache.logging.log4j',
  'slf4j-api': 'org.slf4j',
  'logback-classic': 'ch.qos.logback',
  guava: 'com.google.guava',
  okhttp: 'com.squareup.okhttp3',
  'okhttp3': 'com.squareup.okhttp3',
  hazelcast: 'com.hazelcast',
  'hazelcast-spring': 'com.hazelcast',
  lombok: 'org.projectlombok',
  itext: 'com.lowagie',
  'feign-core': 'io.github.openfeign',
  'feign-gson': 'io.github.openfeign',
  'feign-slf4j': 'io.github.openfeign',
  'micrometer-registry-prometheus': 'io.micrometer',
  'jakarta.validation-api': 'jakarta.validation',
  'jakarta.activation-api': 'jakarta.activation',
  'jakarta.jws-api': 'jakarta.jws',
  'angus-mail': 'org.eclipse.angus',
  'angus-activation': 'org.eclipse.angus',
  snakeyaml: 'org.yaml',
  'tomcat-embed-core': 'org.apache.tomcat.embed',
  'netty-handler': 'io.netty',
  'netty-codec-http': 'io.netty',
}

const INTERNAL_NAME = /^(truper|rmi|recordatorios|common-mvn|rt-truper|ajax-wrapper|wsmail)/i
const INTERNAL_GROUP = /^com\.truper(\.|$)/i
const MAVEN_SCOPES = new Set(['compile', 'runtime', 'test', 'provided', 'system', 'import', 'jar', 'war', 'pom'])

function uniq(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function addMapped(
  target: string[],
  value: string | undefined,
  rules: Array<{ pattern: RegExp; techId: string }>,
): void {
  if (!value) return
  for (const rule of rules) {
    if (rule.pattern.test(value)) target.push(rule.techId)
  }
}

function normalizeVersion(raw?: string): string | undefined {
  if (!raw) return undefined
  let version = raw.trim()
  if (!version || /snapshot/i.test(version)) return undefined
  version = version.replace(/\.jre\d+$/i, '')
  version = version.replace(/^v(?=\d)/i, '')
  return version || undefined
}

/** `composer:vendor/package@version` o `packagist:vendor/package@version`. */
function parseComposerLibrary(raw: string): {
  name: string
  version?: string
  artifactId: string
} | null {
  const match = raw.trim().match(/^(?:composer|packagist):([^@\s]+)(?:@([^\s]+))?$/i)
  if (!match) return null
  const name = match[1]
  if (!name.includes('/')) return null
  return {
    name,
    version: match[2],
    artifactId: name.split('/').at(-1) ?? name,
  }
}

/** Nombres demasiado genéricos: no usarlos como aguja suelta (evita "framework" → CVE de Python). */
const GENERIC_COMPOSER_SHORT_NAMES = new Set([
  'framework', 'core', 'base', 'common', 'commons', 'shared', 'support', 'utils',
  'util', 'helper', 'helpers', 'client', 'server', 'http', 'cache', 'config',
  'default', 'theme', 'module', 'bridge', 'runtime', 'standard', 'api', 'sdk',
])

function composerTextNeedles(packageName: string): string[] {
  const lower = packageName.toLowerCase()
  const needles = [lower]
  const shortName = lower.split('/')[1]
  // Solo el artifact corto si no es genérico (p. ej. monolog sí; framework no).
  if (shortName && shortName.length >= 5 && !GENERIC_COMPOSER_SHORT_NAMES.has(shortName)) {
    needles.push(shortName)
  }
  if (lower.startsWith('magento/')) {
    // Magento: solo tokens del producto, nunca "framework" suelto.
    needles.push('magento', 'adobe commerce', 'magento open source', 'magento community')
  }
  if (lower.startsWith('hyva-themes/')) needles.push('hyva')
  if (lower.startsWith('stripe/')) needles.push('stripe')
  if (lower.startsWith('mageplaza/')) needles.push('mageplaza')
  if (lower.startsWith('magepal/')) needles.push('magepal')
  if (lower.startsWith('guzzlehttp/')) needles.push('guzzle')
  if (lower.startsWith('monolog/')) needles.push('monolog')
  if (lower.startsWith('symfony/')) {
    if (shortName) needles.push(`symfony/${shortName}`)
    // "symfony" solo si el paquete no es un polyfill genérico ruidoso.
    if (shortName && !shortName.startsWith('polyfill')) needles.push('symfony')
  }
  return uniq(needles)
}

/** `wordpress:plugin-slug@version` o `wordpress:wordpress@7.1.4` (core). */
function parseWordPressLibrary(raw: string): {
  name: string
  version?: string
  artifactId: string
  textNeedles: string[]
} | null {
  const match = raw.trim().match(/^wordpress:([^@\s]+)(?:@([^\s]+))?$/i)
  if (!match) return null
  const name = match[1].toLowerCase()
  const version = match[2]
  if (name === 'wordpress' || name === 'core') {
    return {
      name: 'WordPress',
      version,
      artifactId: 'wordpress',
      textNeedles: ['wordpress', 'wp-admin', 'wp-includes'],
    }
  }
  return {
    name,
    version,
    artifactId: name,
    textNeedles: [name, name.replace(/-/g, ' ')],
  }
}

function detectEcosystem(raw: string, groupId?: string): LibraryEcosystem {
  if (/^wordpress:/i.test(raw)) return 'WordPress'
  if (/^(?:composer|packagist):/i.test(raw)) return 'Packagist'
  if (/^npm:|node_modules|@[\w-]+\//i.test(raw)) return 'npm'
  if (/^pypi:|pip:/i.test(raw)) return 'PyPI'
  if (/^go:|golang\.org\//i.test(raw)) return 'Go'
  if (groupId || raw.includes(':') || /\.jar\b/i.test(raw)) return 'Maven'
  return 'Maven'
}

/** Extrae artifactId / nombre corto de coords Maven o `name_version`. */
export function parseLibraryName(raw: string): {
  name: string
  version?: string
  groupId?: string
  artifactId?: string
} {
  const trimmed = raw.trim()
  if (!trimmed) return { name: '' }

  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').filter(Boolean)
    const groupId = parts[0]
    const artifactId = parts[1] ?? parts[0]
    let version: string | undefined
    for (let index = 2; index < parts.length; index += 1) {
      const part = parts[index]
      if (MAVEN_SCOPES.has(part.toLowerCase())) continue
      if (/^\d/.test(part) || /\d+\.\d+/.test(part)) {
        version = part
        break
      }
    }
    return { name: artifactId, version, groupId, artifactId }
  }

  const spaced = trimmed.match(/^([A-Za-z0-9._-]+)\s+([\w.-]+)$/)
  if (spaced) return { name: spaced[1], version: spaced[2], artifactId: spaced[1] }

  const underscored = trimmed.match(/^([A-Za-z0-9.-]+?)_([\w.-]+)$/)
  if (underscored) {
    return { name: underscored[1], version: underscored[2], artifactId: underscored[1] }
  }

  return { name: trimmed, artifactId: trimmed }
}

export function packageKeyOf(ecosystem: string, name: string, version?: string): string {
  return version ? `${ecosystem}:${name}@${version}` : `${ecosystem}:${name}`
}

export function trackLibrary(raw: string): TrackedLibrary | null {
  const wordpress = parseWordPressLibrary(raw)
  if (wordpress) {
    const version = normalizeVersion(wordpress.version)
    const ecosystem: LibraryEcosystem = 'WordPress'
    return {
      raw,
      displayName: wordpress.name === 'WordPress' ? 'WordPress' : wordpress.name,
      artifactId: wordpress.artifactId,
      version,
      ecosystem,
      kind: 'queryable',
      needle: wordpress.textNeedles[0] ?? wordpress.name,
      textNeedles: wordpress.textNeedles,
      packageKey: packageKeyOf(ecosystem, wordpress.name, version),
      watched: { ecosystem, name: wordpress.name, version },
    }
  }

  const composer = parseComposerLibrary(raw)
  if (composer) {
    const version = normalizeVersion(composer.version)
    const ecosystem: LibraryEcosystem = 'Packagist'
    const textNeedles = composerTextNeedles(composer.name)
    return {
      raw,
      displayName: composer.name,
      artifactId: composer.artifactId,
      version,
      ecosystem,
      kind: 'queryable',
      needle: textNeedles[0] ?? composer.name.toLowerCase(),
      textNeedles,
      packageKey: packageKeyOf(ecosystem, composer.name, version),
      watched: { ecosystem, name: composer.name, version },
    }
  }

  const parsed = parseLibraryName(raw)
  if (!parsed.name || parsed.name.length < 2) return null

  const artifactId = parsed.artifactId ?? parsed.name
  const groupId = parsed.groupId ?? MAVEN_GROUP_BY_ARTIFACT[artifactId]
  const version = normalizeVersion(parsed.version)
  const ecosystem = detectEcosystem(raw, groupId)
  const osvName = groupId ? `${groupId}:${artifactId}` : artifactId
  const internal = INTERNAL_NAME.test(artifactId) || (groupId ? INTERNAL_GROUP.test(groupId) : false)
  const kind: LibraryTrackKind = internal ? 'internal' : 'queryable'
  const watched: WatchedPackage | undefined = kind === 'queryable'
    ? { ecosystem, name: osvName, version }
    : undefined

  return {
    raw,
    displayName: artifactId,
    artifactId,
    groupId,
    version,
    ecosystem,
    kind,
    needle: artifactId.toLowerCase(),
    packageKey: packageKeyOf(ecosystem, osvName, version),
    watched,
  }
}

/** Nombres cortos/ambiguos: solo se cruzan por OSV (Maven), no por texto libre. */
const TEXT_NEEDLE_MIN = 5

export function needleFromLibrary(library: TrackedLibrary): string | undefined {
  if (library.kind === 'internal') return undefined
  if (library.needle.length < TEXT_NEEDLE_MIN) return undefined
  return library.needle
}

export function textNeedlesFromLibrary(library: TrackedLibrary): string[] {
  if (library.kind === 'internal') return []
  if (library.textNeedles && library.textNeedles.length > 0) {
    return library.textNeedles.filter((needle) => needle.length >= TEXT_NEEDLE_MIN)
  }
  const needle = needleFromLibrary(library)
  return needle ? [needle] : []
}

/** true si el stack debe aceptar CVEs por framework de alcance además del match de libs. */
export function appStackUsesTechFallback(stack: ResolvedAppStack): boolean {
  return stack.scopeTechIds.length > 0
}

export function resolveAppStack(entry: AppInventoryEntry): ResolvedAppStack {
  const primaryTechIds: string[] = []
  addMapped(primaryTechIds, entry.tecnologia, RUNTIME_MAP)
  addMapped(primaryTechIds, entry.framework, FRAMEWORK_MAP)
  for (const techId of [...primaryTechIds]) {
    const implied = FRAMEWORK_IMPLIES_RUNTIME[techId]
    if (implied) primaryTechIds.push(implied)
  }

  const techIds = [...primaryTechIds]
  for (const database of entry['base de datos'] ?? []) {
    addMapped(techIds, database, DATABASE_MAP)
  }
  for (const library of entry.librerias ?? []) {
    addMapped(techIds, library, LIBRARY_TECH_HINTS)
  }

  const libraries = (entry.librerias ?? [])
    .map(trackLibrary)
    .filter((value): value is TrackedLibrary => Boolean(value))

  const packageNeedles = uniq(
    libraries.flatMap((library) => textNeedlesFromLibrary(library)),
  )
  const watchedPackages = libraries
    .map((library) => library.watched)
    .filter((value): value is WatchedPackage => Boolean(value))

  const uniquePrimary = uniq(primaryTechIds)
  return {
    techIds: uniq(techIds),
    primaryTechIds: uniquePrimary,
    scopeTechIds: uniquePrimary.filter((techId) => SCOPE_TECH_IDS.has(techId)),
    packageNeedles,
    watchedPackages,
    libraries,
  }
}

const appStackCache = new Map<string, { entry: AppInventoryEntry; stack: ResolvedAppStack }>()

/** Cachea por id de app para no recalcular al abrir el select o cambiar filtros. */
export function resolveAppStackCached(appId: string, entry: AppInventoryEntry): ResolvedAppStack {
  const cached = appStackCache.get(appId)
  if (cached && cached.entry === entry) return cached.stack
  const stack = resolveAppStack(entry)
  appStackCache.set(appId, { entry, stack })
  return stack
}

export function appMatchesCveHaystack(
  haystack: string,
  packageNeedles: string[],
): boolean {
  if (packageNeedles.length === 0) return false
  const lower = haystack.toLowerCase()
  return packageNeedles.some((needle) => lower.includes(needle))
}

export function librariesMatchingHaystack(
  haystack: string,
  libraries: TrackedLibrary[],
): string[] {
  const lower = haystack.toLowerCase()
  return libraries
    .filter((library) => {
      if (library.kind === 'internal') return false
      const needle = needleFromLibrary(library)
      return Boolean(needle && lower.includes(needle))
    })
    .map((library) => library.displayName)
}
