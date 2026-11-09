const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

function isLocalHost(hostname: string): boolean {
  return LOCAL_HOSTS.has(hostname)
}

/** En QA/prod fuerza HTTPS; en localhost deja el esquema actual. */
export function enforceHttpsPage(): void {
  if (typeof window === 'undefined') return
  const { protocol, hostname, host, pathname, search, hash } = window.location
  if (protocol === 'https:' || isLocalHost(hostname)) return
  window.location.replace(`https://${host}${pathname}${search}${hash}`)
}

/** Convierte rutas relativas `/api/...` a URL absoluta https fuera de localhost. */
export function toRequestUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    if (url.startsWith('http://') && typeof window !== 'undefined' && !isLocalHost(window.location.hostname)) {
      return `https://${url.slice('http://'.length)}`
    }
    return url
  }
  if (typeof window === 'undefined') return url
  if (isLocalHost(window.location.hostname)) return url
  const path = url.startsWith('/') ? url : `/${url}`
  return `https://${window.location.host}${path}`
}
