import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { EMPTY_APPS_CONFIG, toAppOptions, type AppOption, type AppsConfig } from '../config/apps.schema'
import { loadAppsConfig } from '../config/loadAppsConfig'

export function useAppsConfig(): {
  config: AppsConfig
  options: AppOption[]
  isLoading: boolean
} {
  const query = useQuery({
    queryKey: ['apps-config'],
    queryFn: ({ signal }) => loadAppsConfig(signal),
    staleTime: Infinity,
    retry: 1,
  })

  const config = query.data ?? EMPTY_APPS_CONFIG
  const options = useMemo(() => toAppOptions(config), [config])

  return {
    config,
    options,
    isLoading: query.isPending,
  }
}
