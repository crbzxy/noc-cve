export type ProxyErrorPayload = {
  error: string
  code: 'TIMEOUT' | 'TLS' | 'DNS' | 'NETWORK' | 'UNKNOWN' | 'AUTH' | 'UPSTREAM_HTTP'
  hint: string | undefined
  upstream: string
  status?: number
  detail?: string
}

export declare function describeFetchFailure(error: unknown): string
export declare function authHintForUpstream(target: string, status: number): string | undefined
export declare function networkErrorPayload(
  target: string,
  message: string,
  options?: { aborted?: boolean; timeoutMs?: number; path?: string },
): ProxyErrorPayload
export declare function httpErrorPayload(
  target: string,
  path: string,
  status: number,
  detail: string,
  requestUrl: string,
): ProxyErrorPayload
