import { loadCorpusStore } from '@/server/corpus/loadStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const store = await loadCorpusStore()
  const snapshot = store.getSnapshot()
  if (snapshot) return Response.json(snapshot)

  try {
    const ready = await store.refreshCorpus(false)
    if (!ready) {
      return Response.json(
        { error: (store.getHealth() as { error?: string }).error ?? 'Corpus aún no listo', health: store.getHealth() },
        { status: 503 },
      )
    }
    return Response.json(ready)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ error: message }, { status: 500 })
  }
}
