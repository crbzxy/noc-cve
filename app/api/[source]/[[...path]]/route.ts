import { forwardUpstream } from '@/server/proxy/forward'
import { matchUpstream } from '@/server/proxy/upstreams'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { source: string; path?: string[] }

async function handle(
  request: Request,
  context: { params: Promise<RouteParams> },
) {
  const { source, path: parts } = await context.params
  if (source === 'auth' || source === 'corpus') {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const url = new URL(request.url)
  const suffix = parts?.length ? `/${parts.join('/')}` : ''
  const pathname = `/api/${source}${suffix}`
  const matched = matchUpstream(`${pathname}${url.search}`)
  if (!matched) {
    return Response.json({ error: `Sin upstream para ${pathname}` }, { status: 404 })
  }
  return forwardUpstream(request, matched.upstream, matched.rest)
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle
export const HEAD = handle
