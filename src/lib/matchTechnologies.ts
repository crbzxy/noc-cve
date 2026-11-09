import type { TechnologyConfig } from '../config/sources.schema'
import type { CveRecord } from '../types'

type MatchableCve = Pick<CveRecord, 'id' | 'title' | 'description' | 'packages' | 'aliases'>

export interface CompiledTechMatcher {
  id: string
  keywords: string[]
}

/** Precompila keywords (lowercase, largas primero) una sola vez por config. */
export function compileTechnologyMatchers(
  technologies: TechnologyConfig[],
): CompiledTechMatcher[] {
  return technologies.map((tech) => ({
    id: tech.id,
    keywords: tech.keywords
      .map((keyword) => keyword.toLowerCase().trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length),
  }))
}

function buildHaystack(record: MatchableCve): string {
  // Descripción truncada: basta para keywords y evita escanear textos enormes
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
    for (const keyword of matcher.keywords) {
      if (haystack.includes(keyword)) {
        hits.push(matcher.id)
        break
      }
    }
  }
  return hits
}

export function applyTechnologyTags(
  records: CveRecord[],
  technologies: TechnologyConfig[],
): CveRecord[] {
  const matchers = compileTechnologyMatchers(technologies)
  if (matchers.length === 0) {
    return records.map((record) =>
      record.technologies.length === 0 ? record : { ...record, technologies: [] },
    )
  }
  return records.map((record) => ({
    ...record,
    technologies: matchTechnologies(record, matchers),
  }))
}
