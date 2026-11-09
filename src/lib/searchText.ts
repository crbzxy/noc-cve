function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Token simple (java) → límite de palabra, evita java⊂javascript.
 * Frases o con puntuación (spring-boot, CVE-2026) → substring literal.
 */
export function compileSearchPattern(query: string): RegExp {
  const escaped = escapeRegex(query)
  const useBoundary = !/[\s./_+-]/.test(query)
  if (useBoundary) {
    return new RegExp(`(^|[^a-z0-9])${escaped}(?=[^a-z0-9]|$)`, 'i')
  }
  return new RegExp(escaped, 'i')
}

/** True si el texto contiene la consulta con la semántica de compileSearchPattern. */
export function textMatchesSearch(haystack: string, pattern: RegExp): boolean {
  return pattern.test(haystack)
}
