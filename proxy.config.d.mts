export interface Upstream {
  target: string
  path: string
  headers: (env: Record<string, string | undefined>) => Record<string, string>
}

export interface SourcesConfigJson {
  sources: Array<{
    id: string
    label: string
    enabled: boolean
    role: 'list' | 'enrich' | 'score'
    proxyPrefix: string
    baseUrl: string
    path: string
    authEnv?: string
  }>
  technologies: Array<{
    id: string
    label: string
    keywords: string[]
  }>
  defaults: {
    sortBy: string
    sortDir: string
  }
}

export declare const sourcesConfig: SourcesConfigJson
export declare const upstreams: Record<string, Upstream>
