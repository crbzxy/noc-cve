import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { SEVERITIES, SOURCES, type Severity, type SourceId } from '../types'

export type WindowDays = 1 | 7 | 15 | 30 | 90

const WINDOW_DAYS: WindowDays[] = [1, 7, 15, 30, 90]

export function isWindowDays(value: unknown): value is WindowDays {
  return typeof value === 'number' && (WINDOW_DAYS as number[]).includes(value)
}

interface FiltersState {
  days: WindowDays
  severities: Severity[]
  sources: SourceId[]
  kevOnly: boolean
  /** true = sin filtro por tech (Todas). false + [] = ninguna elegida. */
  techAll: boolean
  technologies: string[]
  minEpss: number
  search: string
  refreshMin: number
  setDays: (d: WindowDays) => void
  toggleSeverity: (s: Severity) => void
  toggleSource: (s: SourceId) => void
  setKevOnly: (v: boolean) => void
  toggleTechnology: (id: string) => void
  setTechnologies: (ids: string[]) => void
  setTechAll: (v: boolean) => void
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
  techAll: true,
  technologies: [] as string[],
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
      toggleTechnology: (id) =>
        set((st) => ({
          techAll: false,
          technologies: toggle(st.technologies, id),
        })),
      setTechnologies: (technologies) => set({ techAll: false, technologies }),
      setTechAll: (techAll) => set({ techAll, ...(techAll ? { technologies: [] as string[] } : {}) }),
      setMinEpss: (minEpss) => set({ minEpss }),
      setSearch: (search) => set({ search }),
      setRefreshMin: (refreshMin) => set({ refreshMin }),
      reset: () => set(defaults),
    }),
    {
      name: 'noc-cve-filters',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ search: _s, ...rest }) => rest,
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<FiltersState>
        return {
          ...current,
          ...saved,
          days: isWindowDays(saved.days) ? saved.days : current.days,
          techAll: typeof saved.techAll === 'boolean'
            ? saved.techAll
            : Array.isArray(saved.technologies) && saved.technologies.length === 0
              ? true
              : current.techAll,
          technologies: Array.isArray(saved.technologies) ? saved.technologies : current.technologies,
        }
      },
    },
  ),
)
