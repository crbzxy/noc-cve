import type { WatchedPackage } from '../config/sources.schema'
import type { AppInventoryEntry } from '../config/apps.schema'

export type LibraryEcosystem = 'Maven' | 'npm' | 'PyPI' | 'Go'

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
  /** Clave estable para maps OSV ↔ UI. */
  packageKey: string
  watched?: WatchedPackage
}

export interface ResolvedAppStack {
  techIds: string[]
  packageNeedles: string[]
  watchedPackages: WatchedPackage[]
  libraries: TrackedLibrary[]
}

const RUNTIME_MAP: Array<{ pattern: RegExp; techId: string }> = [
  { pattern: /\bjava\b/i, techId: 'java' },
]

const FRAMEWORK_MAP: Array<{ pattern: RegExp; techId: string }> = [
  { pattern: /spring/i, techId: 'spring' },
]

const DATABASE_MAP: Array<{ pattern: RegExp; techId: string }> = [
  { pattern: /mongo/i, techId: 'mongodb' },
  { pattern: /redis/i, techId: 'redis' },
  { pattern: /\bsql\b|mssql|sql\s*server/i, techId: 'sqlserver' },
  { pattern: /\bsap\b/i, techId: 'sap' },
]

const LIBRARY_TECH_HINTS: Array<{ pattern: RegExp; techId: string }> = [
  { pattern: /rabbit|amqp/i, techId: 'rabbitmq' },
  { pattern: /mqtt/i, techId: 'mqtt' },
  { pattern: /tomcat/i, techId: 'tomcat' },
  { pattern: /prometheus|micrometer-registry-prometheus/i, techId: 'prometheus' },
  { pattern: /mongodb|mongo-java/i, techId: 'mongodb' },
  { pattern: /redis|jedis|jrejson/i, techId: 'redis' },
  { pattern: /mssql|sqlserver/i, techId: 'sqlserver' },
  { pattern: /sapjco|\.sap\b|commons-sap/i, techId: 'sap' },
  { pattern: /spring/i, techId: 'spring' },
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
  return version || undefined
}

function detectEcosystem(raw: string, groupId?: string): LibraryEcosystem {
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

function needleFromLibrary(library: TrackedLibrary): string | undefined {
  if (library.kind === 'internal') return undefined
  if (library.needle.length < TEXT_NEEDLE_MIN) return undefined
  return library.needle
}

export function resolveAppStack(entry: AppInventoryEntry): ResolvedAppStack {
  const techIds: string[] = []
  addMapped(techIds, entry.tecnologia, RUNTIME_MAP)
  addMapped(techIds, entry.framework, FRAMEWORK_MAP)
  for (const database of entry['base de datos'] ?? []) {
    addMapped(techIds, database, DATABASE_MAP)
  }
  for (const library of entry.librerias ?? []) {
    addMapped(techIds, library, LIBRARY_TECH_HINTS)
  }

  const libraries = (entry.librerias ?? [])
    .map(trackLibrary)
    .filter((value): value is TrackedLibrary => Boolean(value))

  const packageNeedles = uniq(libraries.map(needleFromLibrary).filter((value): value is string => Boolean(value)))
  const watchedPackages = libraries
    .map((library) => library.watched)
    .filter((value): value is WatchedPackage => Boolean(value))

  return {
    techIds: uniq(techIds),
    packageNeedles,
    watchedPackages,
    libraries,
  }
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
