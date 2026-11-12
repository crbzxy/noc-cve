import { loadCorpusStore } from '@/server/corpus/loadStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  const store = await loadCorpusStore()
  try {
    const snapshot = await store.refreshCorpus(true)
    if (!snapshot) {
      return Response.json(
        { error: (store.getHealth() as { error?: string }).error ?? 'Corpus no disponible' },
        { status: 503 },
      )
    }
    return Response.json(snapshot)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ error: message }, { status: 500 })
  }
}
