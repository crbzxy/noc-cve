function toFileUrl(absolutePath: string): string {
  const normalized = absolutePath.replace(/\\/g, '/')
  return normalized.startsWith('/')
    ? `file://${normalized}`
    : `file:///${normalized}`
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  try {
    const href = toFileUrl(`${process.cwd()}/server/corpus/store.mjs`)
    const store = (await import(/* webpackIgnore: true */ href)) as {
      startCorpusWorker: (options: {
        startTimer?: boolean
        ingestOnBoot?: boolean
      }) => Promise<void>
    }
    await store.startCorpusWorker({ startTimer: true, ingestOnBoot: true })
    console.log('[instrumentation] Corpus worker iniciado')
  } catch (error) {
    console.error('[instrumentation] Falló corpus worker', error)
  }
}
