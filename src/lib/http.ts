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
}

function detectFirewallBlock(text: string): string | null {
  const lower = text.toLowerCase()
  if (
    lower.includes('fortiguard')
    || lower.includes('web filter violation')
    || lower.includes('web page blocked')
    || lower.includes('access blocked')
  ) {
    return (
      'FortiGuard bloqueó esta URL (política de Internet). '
      + 'Pide a Seguridad liberar: api.osv.dev, api.first.org, services.nvd.nist.gov, '
      + 'api.github.com, www.cve.org, euvdservices.enisa.europa.eu.'
    )
  }
  return null
}

async function readErrorMessage(res: Response): Promise<string> {
  const rateHint =
    res.status === 403 || res.status === 429 ? ' (rate limit: agrega API key en .env)' : ''
  try {
    const text = await res.text()
    if (!text) return `${res.status} ${res.statusText}${rateHint}`
    const blocked = detectFirewallBlock(text)
    if (blocked) return blocked
    try {
      const parsed = JSON.parse(text) as UpstreamErrorBody
      const parts = [parsed.error, parsed.hint, parsed.detail].filter(Boolean)
      if (parts.length > 0) return parts.join(' — ')
    } catch {
      return text.slice(0, 240)
    }
  } catch {
    // ignore body read errors
  }
  return `${res.status} ${res.statusText}${rateHint}`
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
  const res = await fetch(resolveUrl(url), { signal })
  if (!res.ok) {
    throw new HttpError(res.status, await readErrorMessage(res))
  }
  return { data: await parseJsonBody<T>(res), headers: res.headers }
}

export async function postJson<T>(
  url: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<{ data: T; headers: Headers }> {
  const res = await fetch(resolveUrl(url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    throw new HttpError(res.status, await readErrorMessage(res))
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
