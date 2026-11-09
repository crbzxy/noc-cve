import { useQuery } from '@tanstack/react-query'
import { fetchLatestVersions } from '../sources/latestVersions'
import type { TrackedLibrary } from '../lib/resolveAppStack'

export function useLatestVersions(libraries: TrackedLibrary[], enabled: boolean) {
  const key = libraries
    .filter((library) => library.kind === 'queryable')
    .map((library) => library.packageKey)
    .sort()
    .join('|')

  return useQuery({
    queryKey: ['latest-versions', key],
    queryFn: ({ signal }) => fetchLatestVersions(libraries, signal),
    enabled: enabled && libraries.length > 0 && key.length > 0,
    staleTime: 6 * 60 * 60_000,
    gcTime: 12 * 60 * 60_000,
    retry: 1,
  })
}
