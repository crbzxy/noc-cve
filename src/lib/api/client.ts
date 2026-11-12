export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  if (!text) return `HTTP ${res.status}`
  try {
    const json = JSON.parse(text) as { error?: string; hint?: string; detail?: string }
    return [json.error, json.hint, json.detail].filter(Boolean).join(' · ') || text.slice(0, 300)
  } catch {
    return text.slice(0, 300)
  }
}

/** Cliente same-origin: solo paths `/api/...` (Docker/Next). */
export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<{ data: T; headers: Headers }> {
  const res = await fetch(path, {
    method: 'GET',
    credentials: 'same-origin',
    signal,
  })
  if (res.status === 401 && typeof window !== 'undefined') {
    window.location.assign('/login')
  }
  if (!res.ok) throw new ApiError(res.status, await readErrorMessage(res))
  return { data: await res.json() as T, headers: res.headers }
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<{ data: T; headers: Headers }> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: body === undefined
      ? { Accept: 'application/json' }
      : { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })
  if (res.status === 401 && typeof window !== 'undefined') {
    window.location.assign('/login')
  }
  if (!res.ok) throw new ApiError(res.status, await readErrorMessage(res))
  return { data: await res.json() as T, headers: res.headers }
}
