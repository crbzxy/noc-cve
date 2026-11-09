import type { TechnologyConfig } from '../config/sources.schema'
import type { CveRecord } from '../types'

type MatchableCve = Pick<CveRecord, 'id' | 'title' | 'description' | 'packages' | 'aliases'>

export interface CompiledTechMatcher {
  id: string
  patterns: RegExp[]
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Keyword corta/simple → boundary; frases o con puntuación → includes literal escapado. */
function compileKeywordPattern(keyword: string): RegExp {
  const escaped = escapeRegex(keyword)
  const useBoundary = !/[\s./_+-]/.test(keyword)
  if (useBoundary) {
    return new RegExp(`(^|[^a-z0-9])${escaped}(?=[^a-z0-9]|$)`, 'i')
  }
  return new RegExp(escaped, 'i')
}

/** Precompila keywords (lowercase, largas primero) una sola vez por config. */
export function compileTechnologyMatchers(
  technologies: TechnologyConfig[],
): CompiledTechMatcher[] {
  return technologies.map((tech) => {
    const keywords = tech.keywords
      .map((keyword) => keyword.toLowerCase().trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
    return {
      id: tech.id,
      patterns: keywords.map(compileKeywordPattern),
    }
  })
}

function buildHaystack(record: MatchableCve): string {
  const description = record.description.length > 480
    ? record.description.slice(0, 480)
    : record.description
  return [
    record.id,
    record.title ?? '',
    description,
    record.packages.join(' '),
    record.aliases.join(' '),
  ]
    .join('\n')
    .toLowerCase()
}

export function matchTechnologies(
  record: MatchableCve,
  matchers: CompiledTechMatcher[],
): string[] {
  if (matchers.length === 0) return []
  const haystack = buildHaystack(record)
  const hits: string[] = []
  for (const matcher of matchers) {
    if (matcher.patterns.some((pattern) => pattern.test(haystack))) {
      hits.push(matcher.id)
    }
  }
  return hits
}

/** Cache por id+firma de contenido: evita re-escaneo regex al cambiar de app. */
const technologyTagCache = new Map<string, { signature: string; technologies: string[] }>()
let technologyMatchersKey = ''

function recordSignature(record: MatchableCve): string {
  return [
    record.title ?? '',
    String(record.description.length),
    record.packages.join(','),
    record.aliases.join(','),
  ].join('|')
}

function technologiesKey(technologies: TechnologyConfig[]): string {
  return technologies
    .map((tech) => `${tech.id}:${tech.keywords.join(',')}`)
    .join(';')
}

export function applyTechnologyTags(
  records: CveRecord[],
  technologies: TechnologyConfig[],
): CveRecord[] {
  const nextMatchersKey = technologiesKey(technologies)
  if (nextMatchersKey !== technologyMatchersKey) {
    technologyTagCache.clear()
    technologyMatchersKey = nextMatchersKey
  }

  const matchers = compileTechnologyMatchers(technologies)
  if (matchers.length === 0) {
    return records.map((record) =>
      record.technologies.length === 0 ? record : { ...record, technologies: [] },
    )
  }

  return records.map((record) => {
    const signature = recordSignature(record)
    const cached = technologyTagCache.get(record.id)
    if (cached && cached.signature === signature) {
      if (
        record.technologies.length === cached.technologies.length
        && record.technologies.every((techId, index) => techId === cached.technologies[index])
      ) {
        return record
      }
      return { ...record, technologies: cached.technologies }
    }

    const technologiesMatched = matchTechnologies(record, matchers)
    technologyTagCache.set(record.id, { signature, technologies: technologiesMatched })
    if (
      record.technologies.length === technologiesMatched.length
      && record.technologies.every((techId, index) => techId === technologiesMatched[index])
    ) {
      return record
    }
    return { ...record, technologies: technologiesMatched }
  })
}
