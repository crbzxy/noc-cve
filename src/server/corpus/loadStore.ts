export type CorpusStore = {
  getHealth: () => unknown
  getSnapshot: () => unknown
  refreshCorpus: (force: boolean) => Promise<unknown>
  startCorpusWorker: (options: {
    startTimer?: boolean
    ingestOnBoot?: boolean
  }) => Promise<void>
}

function toFileUrl(absolutePath: string): string {
  const normalized = absolutePath.replace(/\\/g, '/')
  return normalized.startsWith('/')
    ? `file://${normalized}`
    : `file:///${normalized}`
}

export async function loadCorpusStore(): Promise<CorpusStore> {
  const absolutePath = `${process.cwd()}/server/corpus/store.mjs`
  const href = toFileUrl(absolutePath)
  return import(/* webpackIgnore: true */ href) as Promise<CorpusStore>
}
