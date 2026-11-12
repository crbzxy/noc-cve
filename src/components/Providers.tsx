'use client'

import { CssBaseline, ThemeProvider } from '@mui/material'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { theme } from '@/theme'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { refetchOnWindowFocus: false } },
  }))

  return (
    <AppRouterCacheProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme} defaultMode="dark">
          <CssBaseline />
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </AppRouterCacheProvider>
  )
}
