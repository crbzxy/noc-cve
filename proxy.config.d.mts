export interface Upstream {
  target: string
  path: string
  headers: (env: Record<string, string | undefined>) => Record<string, string>
}
export declare const upstreams: Record<string, Upstream>
