import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { SEVERITIES, SOURCES, type Severity, type SourceId } from '../types'

export type WindowDays = 1 | 3 | 7 | 14 | 30

interface FiltersState {
  days: WindowDays
  severities: Severity[]
  sources: SourceId[]
  kevOnly: boolean
  minEpss: number // 0..1
  search: string
  refreshMin: number
  setDays: (d: WindowDays) => void
  toggleSeverity: (s: Severity) => void
  toggleSource: (s: SourceId) => void
  setKevOnly: (v: boolean) => void
  setMinEpss: (v: number) => void
  setSearch: (v: string) => void
  setRefreshMin: (v: number) => void
  reset: () => void
}

const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x])

const defaults = {
  days: 7 as WindowDays,
  severities: [...SEVERITIES] as Severity[],
  sources: [...SOURCES] as SourceId[],
  kevOnly: false,
  minEpss: 0,
  search: '',
  refreshMin: 15,
}

export const useFilters = create<FiltersState>()(
  persist(
    (set) => ({
      ...defaults,
      setDays: (days) => set({ days }),
      toggleSeverity: (s) => set((st) => ({ severities: toggle(st.severities, s) })),
      toggleSource: (s) => set((st) => ({ sources: toggle(st.sources, s) })),
      setKevOnly: (kevOnly) => set({ kevOnly }),
      setMinEpss: (minEpss) => set({ minEpss }),
      setSearch: (search) => set({ search }),
      setRefreshMin: (refreshMin) => set({ refreshMin }),
      reset: () => set(defaults),
    }),
    {
      name: 'noc-cve-filters',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ search: _s, ...rest }) => rest, // la búsqueda no se persiste
    },
  ),
)
