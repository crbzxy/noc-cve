export class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type UpstreamErrorBody = {
  error?: string
  hint?: string
  detail?: string
  status?: number
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
    on401: 'CVE.org no usa API key. Revisa firewall/TLS hacia www.cve.org.',
    on403: 'CVE.org 403: no hay API key. Pide a Seguridad liberar/excluir www.cve.org (Web Filter / SSL Inspection).',
    on429: 'CVE.org rate limit (429). Espera y reintenta; no hay API key en beta.',
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

async function readErrorMessage(res: Response, requestUrl: string): Promise<string> {
  const hint = statusHintForUrl(requestUrl, res.status)
  try {
    const text = await res.text()
    if (!text) {
      return hint
        ? `${res.status} ${res.statusText} — ${hint}`
        : `${res.status} ${res.statusText}`
    }
    const blocked = detectFirewallBlock(text)
    if (blocked) return blocked
    try {
      const parsed = JSON.parse(text) as UpstreamErrorBody
      const parts = [parsed.error, parsed.hint, parsed.detail].filter(Boolean)
      if (parts.length > 0) return parts.join(' — ')
    } catch {
      const snippet = text.slice(0, 240)
      return hint ? `${snippet} — ${hint}` : snippet
    }
  } catch {
    // ignore body read errors
  }
  return hint
    ? `${res.status} ${res.statusText} — ${hint}`
    : `${res.status} ${res.statusText}`
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
  const res = await fetch(resolved, { signal })
  if (!res.ok) {
    throw new HttpError(res.status, await readErrorMessage(res, resolved))
  }
  return { data: await parseJsonBody<T>(res), headers: res.headers }
}

export async function postJson<T>(
  url: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<{ data: T; headers: Headers }> {
  const resolved = resolveUrl(url)
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
