export class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type UpstreamErrorBody = {
  error?: unknown
  hint?: unknown
  detail?: unknown
  code?: unknown
  status?: number
}

/** Undici oculta TLS/DNS en `error.cause`; el mensaje suele ser solo "fetch failed". */
function describeFetchFailure(error: unknown): string {
  const parts: string[] = []
  let current: unknown = error
  for (let depth = 0; current && depth < 6; depth += 1) {
    if (current instanceof Error) {
      if (current.message) parts.push(current.message)
      const code = 'code' in current ? current.code : undefined
      if (typeof code === 'string' && code) parts.push(code)
      current = current.cause
      continue
    }
    parts.push(String(current))
    break
  }
  const unique = [...new Set(parts.map((part) => part.trim()).filter(Boolean))]
  return unique.length > 0 ? unique.join(' · ') : 'Error de red desconocido'
}

function messagePart(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() && value.trim() !== 'true' && value.trim() !== 'false') {
    return value.trim()
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

/** Corrige mensajes engañosos o basura (`true`) guardados en corpus / upstream. */
export function normalizeSourceError(sourceId: string, error: string | undefined): string | undefined {
  if (!error) return undefined
  const trimmed = error.replace(/\s+/g, ' ').trim()
  if (!trimmed) return undefined

  if (trimmed === 'true' || trimmed === 'false') {
    if (sourceId === 'vulncheck-kev') return 'Falta VULNCHECK_TOKEN en .env (el API respondió sin detalle).'
    if (sourceId === 'wordfence') return 'Falta WORDFENCE_API_KEY en .env (el API respondió sin detalle).'
    return 'El upstream respondió sin mensaje útil. Revisa token/.env o firewall.'
  }

  if (
    (sourceId === 'cveorg' || /cve\.org/i.test(trimmed))
    && /api\s*key/i.test(trimmed)
  ) {
    return 'CVE.org 403: no usa API key. Pide a Seguridad liberar/excluir www.cve.org (Web Filter / SSL Inspection).'
  }

  return error
}

const FORTIGUARD_HOSTS = [
  'services.nvd.nist.gov',
  'api.github.com',
  'www.cve.org',
  'www.wordfence.com',
  'api.osv.dev',
  'euvdservices.enisa.europa.eu',
  'www.cisa.gov',
  'api.vulncheck.com',
  'api.first.org',
].join(', ')

type SourceHint = {
  match: RegExp
  on403: string
  on401: string
  on429: string
}

const SOURCE_HINTS: SourceHint[] = [
  {
    match: /\/api\/nvd\b/,
    on401: 'NVD: agrega NVD_API_KEY en .env (opcional pero recomendado).',
    on403: 'NVD rechazó la petición. Revisa NVD_API_KEY o rate limit.',
    on429: 'NVD rate limit. Agrega NVD_API_KEY en .env (sube el cupo).',
  },
  {
    match: /\/api\/github\b/,
    on401: 'GitHub: agrega GITHUB_TOKEN en .env.',
    on403: 'GitHub 403: suele ser rate limit sin token. Agrega GITHUB_TOKEN en .env.',
    on429: 'GitHub rate limit. Agrega GITHUB_TOKEN en .env.',
  },
  {
    match: /\/api\/cveorg\b/,
    on401: 'CVE.org no pide credenciales. Revisa firewall/TLS hacia www.cve.org.',
    on403: 'CVE.org 403: suele ser Web Filter / SSL Inspection. Pide a Seguridad liberar www.cve.org (no usa API key).',
    on429: 'CVE.org rate limit (429). Espera y reintenta (beta sin API key).',
  },
  {
    match: /\/api\/wordfence\b/,
    on401: 'Wordfence: agrega WORDFENCE_API_KEY en .env.',
    on403: 'Wordfence 403: agrega WORDFENCE_API_KEY en .env, o pide a Seguridad liberar www.wordfence.com.',
    on429: 'Wordfence rate limit. Revisa WORDFENCE_API_KEY / cupo.',
  },
  {
    match: /\/api\/vckev\b/,
    on401: 'VulnCheck: agrega VULNCHECK_TOKEN en .env.',
    on403: 'VulnCheck 403: revisa VULNCHECK_TOKEN en .env.',
    on429: 'VulnCheck rate limit. Revisa VULNCHECK_TOKEN / cupo.',
  },
  {
    match: /\/api\/osv\b/,
    on401: 'OSV no requiere API key. Revisa firewall hacia api.osv.dev.',
    on403: 'OSV 403: no requiere API key. Revisa firewall/WAF hacia api.osv.dev.',
    on429: 'OSV rate limit. Reduce frecuencia de querybatch.',
  },
  {
    match: /\/api\/epss\b/,
    on401: 'EPSS no requiere API key. Revisa firewall hacia api.first.org.',
    on403: 'EPSS 403: no requiere API key. Revisa firewall hacia api.first.org.',
    on429: 'EPSS rate limit. Reduce el lote de CVEs consultados.',
  },
  {
    match: /\/api\/euvd\b/,
    on401: 'EUVD no requiere API key. Revisa firewall hacia euvdservices.enisa.europa.eu.',
    on403: 'EUVD 403: no requiere API key. Revisa firewall hacia euvdservices.enisa.europa.eu.',
    on429: 'EUVD rate limit. Espera y reintenta.',
  },
  {
    match: /\/api\/kev\b/,
    on401: 'CISA KEV es un JSON público. Revisa firewall hacia www.cisa.gov.',
    on403: 'CISA KEV 403: no requiere API key. Revisa firewall hacia www.cisa.gov.',
    on429: 'CISA KEV rate limit. Espera y reintenta.',
  },
]

function detectFirewallBlock(text: string): string | null {
  const lower = text.toLowerCase()
  if (
    lower.includes('fortiguard')
    || lower.includes('web filter violation')
    || lower.includes('web page blocked')
    || lower.includes('access blocked')
  ) {
    return `FortiGuard bloqueó esta URL. Pide a Seguridad liberar: ${FORTIGUARD_HOSTS}.`
  }
  return null
}

function statusHintForUrl(url: string, status: number): string | null {
  const rule = SOURCE_HINTS.find((item) => item.match.test(url))
  if (!rule) {
    if (status === 401 || status === 403 || status === 429) {
      return 'Revisa credenciales en .env o pide a Seguridad liberar el host (Web Filter / SSL Inspection).'
    }
    return null
  }
  if (status === 401) return rule.on401
  if (status === 403) return rule.on403
  if (status === 429) return rule.on429
  return null
}

function sourceIdFromProxyUrl(requestUrl: string): string {
  if (/\/api\/cveorg\b/.test(requestUrl)) return 'cveorg'
  if (/\/api\/vckev\b/.test(requestUrl)) return 'vulncheck-kev'
  if (/\/api\/wordfence\b/.test(requestUrl)) return 'wordfence'
  if (/\/api\/kev\b/.test(requestUrl)) return 'kev'
  if (/\/api\/euvd\b/.test(requestUrl)) return 'euvd'
  return 'unknown'
}

async function readErrorMessage(res: Response, requestUrl: string): Promise<string> {
  const hint = statusHintForUrl(requestUrl, res.status)
  const sourceId = sourceIdFromProxyUrl(requestUrl)
  try {
    const text = await res.text()
    if (!text) {
      const empty = hint
        ? `${res.status} ${res.statusText} — ${hint}`
        : `${res.status} ${res.statusText}`
      return normalizeSourceError(sourceId, empty) ?? empty
    }
    const blocked = detectFirewallBlock(text)
    if (blocked) return blocked
    try {
      const parsed = JSON.parse(text) as UpstreamErrorBody
      const parts = [
        messagePart(parsed.error),
        messagePart(parsed.hint),
        messagePart(parsed.detail),
        messagePart(parsed.code),
      ].filter((part): part is string => Boolean(part))
      if (parts.length > 0) {
        const joined = parts.join(' — ')
        const withHint = hint && !joined.includes(hint) ? `${joined} — ${hint}` : joined
        return normalizeSourceError(sourceId, withHint) ?? withHint
      }
      if (hint) return `${res.status} ${res.statusText} — ${hint}`
    } catch {
      const snippet = text.slice(0, 240).trim()
      if (snippet === 'true' || snippet === 'false') {
        const fallback = hint
          ? `${res.status} ${res.statusText} — ${hint}`
          : `${res.status} ${res.statusText}`
        return normalizeSourceError(sourceId, snippet) ?? fallback
      }
      const withSnippet = hint ? `${snippet} — ${hint}` : snippet
      return normalizeSourceError(sourceId, withSnippet) ?? withSnippet
    }
  } catch {
    // ignore body read errors
  }
  const finalMessage = hint
    ? `${res.status} ${res.statusText} — ${hint}`
    : `${res.status} ${res.statusText}`
  return normalizeSourceError(sourceId, finalMessage) ?? finalMessage
}

async function parseJsonBody<T>(res: Response): Promise<T> {
  const text = await res.text()
  const blocked = detectFirewallBlock(text)
  if (blocked) throw new HttpError(451, blocked)
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('json') && text.trimStart().startsWith('<')) {
    throw new HttpError(
      res.status || 502,
      'La respuesta no es JSON (posible bloqueo del proxy/firewall corporativo).',
    )
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new HttpError(res.status || 502, 'No se pudo parsear la respuesta JSON del upstream')
  }
}

/** Base absoluta para ingesta Node (CORPUS_API_BASE); vacío en el browser. */
export function getApiBase(): string {
  const runtime = globalThis as { process?: { env?: Record<string, string | undefined> } }
  const value = runtime.process?.env?.CORPUS_API_BASE
  return typeof value === 'string' ? value.replace(/\/$/, '') : ''
}

function resolveUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  const base = getApiBase()
  return base ? `${base}${url}` : url
}

export async function getJson<T>(url: string, signal?: AbortSignal): Promise<{ data: T; headers: Headers }> {
  const resolved = resolveUrl(url)
  try {
    const res = await fetch(resolved, { signal })
    if (!res.ok) {
      throw new HttpError(res.status, await readErrorMessage(res, resolved))
    }
    return { data: await parseJsonBody<T>(res), headers: res.headers }
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(0, describeFetchFailure(error))
  }
}

export async function postJson<T>(
  url: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<{ data: T; headers: Headers }> {
  const resolved = resolveUrl(url)
  try {
    const res = await fetch(resolved, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
    if (!res.ok) {
      throw new HttpError(res.status, await readErrorMessage(res, resolved))
    }
    return { data: await parseJsonBody<T>(res), headers: res.headers }
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(0, describeFetchFailure(error))
  }
}

export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(signal.reason)
    })
  })

export const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000)

export function normalizeSeverity(s?: string | null): import('../types').Severity {
  switch ((s ?? '').toUpperCase()) {
    case 'CRITICAL':
      return 'CRITICAL'
    case 'HIGH':
      return 'HIGH'
    case 'MEDIUM':
    case 'MODERATE':
      return 'MEDIUM'
    case 'LOW':
      return 'LOW'
    default:
      return 'NONE'
  }
}
