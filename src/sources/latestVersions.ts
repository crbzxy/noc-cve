import type { TrackedLibrary } from '../lib/resolveAppStack'

export interface LatestVersionInfo {
  packageKey: string
  latest: string | null
  /** latest | lts | unknown — LTS solo cuando el ecosistema lo publica explícito (p. ej. npm). */
  channel: 'latest' | 'lts' | 'unknown'
  error?: string
}

const CONCURRENCY = 6
const cache = new Map<string, LatestVersionInfo>()

function mavenPath(groupId: string, artifactId: string): string {
  return `${groupId.replace(/\./g, '/')}/${artifactId}/maven-metadata.xml`
}

function parseMavenLatest(xml: string): string | null {
  const release = xml.match(/<release>\s*([^<]+?)\s*<\/release>/i)?.[1]?.trim()
  if (release) return release
  const latest = xml.match(/<latest>\s*([^<]+?)\s*<\/latest>/i)?.[1]?.trim()
  if (latest) return latest
  const versions = [...xml.matchAll(/<version>\s*([^<]+?)\s*<\/version>/gi)].map((match) => match[1].trim())
  return versions.at(-1) ?? null
}

async function fetchMavenLatest(
  groupId: string,
  artifactId: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const path = mavenPath(groupId, artifactId)
  const response = await fetch(`/api/maven-central/${path}`, { signal, credentials: 'same-origin' })
  if (!response.ok) throw new Error(`Maven ${response.status}`)
  const xml = await response.text()
  return parseMavenLatest(xml)
}

async function fetchNpmLatest(name: string, signal?: AbortSignal): Promise<{
  latest: string | null
  lts: string | null
}> {
  const response = await fetch(`/api/npm-registry/${encodeURIComponent(name)}`, {
    signal,
    credentials: 'same-origin',
  })
  if (!response.ok) throw new Error(`npm ${response.status}`)
  const data = await response.json() as {
    'dist-tags'?: Record<string, string>
  }
  const tags = data['dist-tags'] ?? {}
  return {
    latest: tags.latest ?? null,
    lts: tags.lts ?? null,
  }
}

async function fetchPypiLatest(name: string, signal?: AbortSignal): Promise<string | null> {
  const response = await fetch(`/api/pypi/${encodeURIComponent(name)}/json`, {
    signal,
    credentials: 'same-origin',
  })
  if (!response.ok) throw new Error(`PyPI ${response.status}`)
  const data = await response.json() as { info?: { version?: string } }
  return data.info?.version ?? null
}

/** Go module path → última versión en proxy.golang.org. */
async function fetchGoLatest(modulePath: string, signal?: AbortSignal): Promise<string | null> {
  const encoded = modulePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  const response = await fetch(`/api/go-proxy/${encoded}/@latest`, {
    signal,
    credentials: 'same-origin',
  })
  if (!response.ok) throw new Error(`Go ${response.status}`)
  const data = await response.json() as { Version?: string }
  return data.Version ?? null
}

function packageNameForCatalog(library: TrackedLibrary): string {
  if (library.watched?.name) return library.watched.name
  return library.artifactId
}

async function resolveOne(library: TrackedLibrary, signal?: AbortSignal): Promise<LatestVersionInfo> {
  const cached = cache.get(library.packageKey)
  if (cached) return cached

  if (library.kind === 'internal') {
    const info: LatestVersionInfo = {
      packageKey: library.packageKey,
      latest: null,
      channel: 'unknown',
    }
    cache.set(library.packageKey, info)
    return info
  }

  try {
    if (library.ecosystem === 'Maven' && library.groupId) {
      const latest = await fetchMavenLatest(library.groupId, library.artifactId, signal)
      const info: LatestVersionInfo = {
        packageKey: library.packageKey,
        latest,
        channel: latest ? 'latest' : 'unknown',
      }
      cache.set(library.packageKey, info)
      return info
    }

    if (library.ecosystem === 'npm') {
      const tags = await fetchNpmLatest(packageNameForCatalog(library), signal)
      const info: LatestVersionInfo = {
        packageKey: library.packageKey,
        latest: tags.lts ?? tags.latest,
        channel: tags.lts ? 'lts' : tags.latest ? 'latest' : 'unknown',
      }
      cache.set(library.packageKey, info)
      return info
    }

    if (library.ecosystem === 'PyPI') {
      const latest = await fetchPypiLatest(packageNameForCatalog(library), signal)
      const info: LatestVersionInfo = {
        packageKey: library.packageKey,
        latest,
        channel: latest ? 'latest' : 'unknown',
      }
      cache.set(library.packageKey, info)
      return info
    }

    if (library.ecosystem === 'Go') {
      const latest = await fetchGoLatest(packageNameForCatalog(library), signal)
      const info: LatestVersionInfo = {
        packageKey: library.packageKey,
        latest,
        channel: latest ? 'latest' : 'unknown',
      }
      cache.set(library.packageKey, info)
      return info
    }

    const info: LatestVersionInfo = {
      packageKey: library.packageKey,
      latest: null,
      channel: 'unknown',
      error: 'Ecosistema sin consulta de versión',
    }
    cache.set(library.packageKey, info)
    return info
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      packageKey: library.packageKey,
      latest: null,
      channel: 'unknown',
      error: message,
    }
  }
}

/** Comparación semver simple (números); suficiente para resaltar desfase. */
export function isVersionBehind(current?: string, latest?: string | null): boolean {
  if (!current || !latest) return false
  const parse = (value: string) => value.split(/[.+_-]/).map((part) => {
    const match = part.match(/\d+/)
    return match ? Number(match[0]) : 0
  })
  const left = parse(current)
  const right = parse(latest)
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const diff = (right[index] ?? 0) - (left[index] ?? 0)
    if (diff > 0) return true
    if (diff < 0) return false
  }
  return false
}

export async function fetchLatestVersions(
  libraries: TrackedLibrary[],
  signal?: AbortSignal,
): Promise<Record<string, LatestVersionInfo>> {
  const queryable = libraries.filter((library) => library.kind === 'queryable')
  const out: Record<string, LatestVersionInfo> = {}

  for (let index = 0; index < queryable.length; index += CONCURRENCY) {
    if (signal?.aborted) break
    const slice = queryable.slice(index, index + CONCURRENCY)
    const rows = await Promise.all(slice.map((library) => resolveOne(library, signal)))
    for (const row of rows) out[row.packageKey] = row
  }

  return out
}
