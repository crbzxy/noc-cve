import { describeFetchFailure, httpErrorPayload, networkErrorPayload } from '../../../proxy.errors.mjs'
import type { Upstream } from './upstreams'

const DEFAULT_TIMEOUT_MS = 60_000

export async function forwardUpstream(
  request: Request,
  upstream: Upstream,
  rest: string,
): Promise<Response> {
  const method = request.method.toUpperCase()
  const url = `${upstream.target}${upstream.path}${rest}`
  const timeoutMs = Number(process.env.UPSTREAM_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'noc-cve-dashboard',
      ...upstream.headers(process.env),
    }
    const inboundType = request.headers.get('content-type')
    if (inboundType) headers['Content-Type'] = inboundType

    const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer()
    const upstreamResponse = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    })

    const responseBody = Buffer.from(await upstreamResponse.arrayBuffer())
    if (!upstreamResponse.ok) {
      const detail = responseBody.length
        ? responseBody.toString('utf8').slice(0, 500)
        : `Upstream respondió ${upstreamResponse.status} sin cuerpo (¿firewall hacia ${upstream.target}?)`
      return Response.json(
        httpErrorPayload(upstream.target, upstream.path, upstreamResponse.status, detail, url),
        { status: 502 },
      )
    }

    const outHeaders = new Headers({
      'content-type': upstreamResponse.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
    })
    const link = upstreamResponse.headers.get('link')
    if (link) outHeaders.set('link', link)
    return new Response(responseBody, { status: upstreamResponse.status, headers: outHeaders })
  } catch (error) {
    return Response.json(
      networkErrorPayload(upstream.target, describeFetchFailure(error), {
        aborted: controller.signal.aborted,
        timeoutMs,
        path: upstream.path,
      }),
      { status: 502 },
    )
  } finally {
    clearTimeout(timer)
  }
}
