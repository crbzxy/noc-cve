import { useQuery } from '@tanstack/react-query'
import { loadSourcesConfig } from '../config/loadSourcesConfig'
import { FALLBACK_SOURCES_CONFIG, type AppSourcesConfig } from '../config/sources.schema'

export function useSourcesConfig(): {
  config: AppSourcesConfig
  isLoading: boolean
  isError: boolean
} {
  const query = useQuery({
    queryKey: ['sources-config'],
    queryFn: ({ signal }) => loadSourcesConfig(signal),
    staleTime: Infinity,
    retry: 1,
  })

  return {
    config: query.data ?? FALLBACK_SOURCES_CONFIG,
    isLoading: query.isPending,
    isError: query.isError,
  }
}
