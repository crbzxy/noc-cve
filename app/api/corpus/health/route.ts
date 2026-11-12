import { loadCorpusStore } from '@/server/corpus/loadStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const store = await loadCorpusStore()
  return Response.json(store.getHealth())
}
