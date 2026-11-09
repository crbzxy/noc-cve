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

async function readErrorMessage(res: Response): Promise<string> {
  const rateHint =
    res.status === 403 || res.status === 429 ? ' (rate limit: agrega API key en .env)' : ''
  try {
    const text = await res.text()
    if (!text) return `${res.status} ${res.statusText}${rateHint}`
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
  return { data: (await res.json()) as T, headers: res.headers }
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
  return { data: (await res.json()) as T, headers: res.headers }
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
