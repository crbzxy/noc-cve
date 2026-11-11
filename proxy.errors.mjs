/** Mensajes accionables para fallos de proxy upstream (Vite + server). */

const TLS_PATTERN = /self-signed|certificate|UNABLE_TO_VERIFY|CERT_UNTRUSTED|unable to get local issuer/i
const DNS_PATTERN = /ENOTFOUND|EAI_AGAIN|getaddrinfo/i
const REFUSED_PATTERN = /ECONNREFUSED|ECONNRESET|ETIMEDOUT|EPIPE/i

/**
 * Undici suele devolver solo "fetch failed"; la causa real está en `error.cause`.
 * @param {unknown} error
 * @returns {string}
 */
export function describeFetchFailure(error) {
  const parts = []
  let current = error
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

/**
 * @param {string} target
 * @param {number} status
 * @returns {string | undefined}
 */
export function authHintForUpstream(target, status) {
  if (status !== 401 && status !== 403) return undefined
  if (target.includes('vulncheck')) return 'Agrega VULNCHECK_TOKEN en .env.'
  if (target.includes('wordfence')) return 'Agrega WORDFENCE_API_KEY en .env.'
  if (target.includes('cve.org')) {
    return 'CVE.org no usa API key: pide a Seguridad liberar/excluir www.cve.org (Web Filter / SSL Inspection).'
  }
  if (target.includes('github.com')) return 'Agrega GITHUB_TOKEN en .env si es rate limit.'
  if (target.includes('nvd.nist')) return 'Revisa NVD_API_KEY o rate limit.'
  return 'Revisa credenciales .env o pide a Seguridad liberar el host.'
}

/**
 * @param {string} target
 * @param {string} message
 * @param {{ aborted?: boolean, timeoutMs?: number, path?: string }} options
 */
export function networkErrorPayload(target, message, options = {}) {
  const aborted = Boolean(options.aborted)
  const timeoutMs = options.timeoutMs ?? 30_000
  const path = options.path ?? ''
  const tlsIssue = TLS_PATTERN.test(message)
  const dnsIssue = DNS_PATTERN.test(message)
  const refused = REFUSED_PATTERN.test(message)

  let hint = `Verifica salida HTTPS hacia ${target} (firewall / Web Filter).`
  if (tlsIssue) {
    hint = `Pide a Seguridad excluir ${target} de SSL Inspection o confiar el CA corporativo en el SO.`
  } else if (dnsIssue) {
    hint = `No se resolvió el DNS de ${target}. Revisa red/DNS del contenedor.`
  } else if (refused) {
    hint = `Conexión rechazada o cortada hacia ${target}. Revisa firewall / proxy corporativo.`
  } else if (aborted) {
    hint = `El upstream no respondió a tiempo. Reintenta o sube UPSTREAM_TIMEOUT_MS.`
  }

  return {
    error: aborted
      ? `Timeout (${timeoutMs} ms) al consultar ${target}`
      : `Fallo de red hacia ${target}: ${message}`,
    code: aborted ? 'TIMEOUT' : tlsIssue ? 'TLS' : dnsIssue ? 'DNS' : refused ? 'NETWORK' : 'UNKNOWN',
    hint,
    upstream: `${target}${path}`,
  }
}

/**
 * @param {string} target
 * @param {string} path
 * @param {number} status
 * @param {string} detail
 * @param {string} requestUrl
 */
export function httpErrorPayload(target, path, status, detail, requestUrl) {
  const tlsInBody = TLS_PATTERN.test(detail)
  return {
    error: `No se pudo consultar ${target}${path}`,
    status,
    detail,
    code: status === 401 || status === 403 ? 'AUTH' : tlsInBody ? 'TLS' : 'UPSTREAM_HTTP',
    hint: tlsInBody
      ? `Pide a Seguridad excluir ${target} de SSL Inspection.`
      : authHintForUpstream(target, status),
    upstream: requestUrl.split('?')[0],
  }
}
