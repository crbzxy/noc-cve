import { FormControl, InputLabel, MenuItem, OutlinedInput, Select, type SelectChangeEvent } from '@mui/material'
import { useMemo, useTransition } from 'react'
import { useAppsConfig } from '../hooks/useAppsConfig'
import { resolveAppStackCached } from '../lib/resolveAppStack'
import { useFilters } from '../store/filters'

const NONE = ''

export function AppSelect({ minWidth = 260 }: { minWidth?: number }) {
  const { options } = useAppsConfig()
  const selectedAppId = useFilters((state) => state.selectedAppId)
  const setSelectedApp = useFilters((state) => state.setSelectedApp)
  const setTechnologies = useFilters((state) => state.setTechnologies)
  const setTechAll = useFilters((state) => state.setTechAll)
  const [isPending, startTransition] = useTransition()

  const menuOptions = useMemo(
    () => options.map((option) => {
      const resolved = resolveAppStackCached(option.id, option.entry)
      return {
        id: option.id,
        label: option.label,
        entry: option.entry,
        libCount: resolved.libraries.length,
        techCount: resolved.techIds.length,
        techIds: resolved.techIds,
      }
    }),
    [options],
  )

  const byId = useMemo(
    () => Object.fromEntries(menuOptions.map((option) => [option.id, option])),
    [menuOptions],
  )

  if (menuOptions.length === 0) return null

  const onChange = (event: SelectChangeEvent<string>) => {
    const nextId = event.target.value
    startTransition(() => {
      if (!nextId) {
        setSelectedApp(null)
        setTechAll(true)
        return
      }
      const option = byId[nextId]
      if (!option) return
      setSelectedApp(nextId)
      if (option.techIds.length > 0) setTechnologies(option.techIds)
      else setTechnologies([])
    })
  }

  return (
    <FormControl size="small" sx={{ minWidth, opacity: isPending ? 0.72 : 1, transition: 'opacity 120ms ease' }}>
      <InputLabel id="app-select-label">Aplicación</InputLabel>
      <Select
        labelId="app-select-label"
        value={selectedAppId ?? NONE}
        onChange={onChange}
        input={<OutlinedInput label="Aplicación" />}
        MenuProps={{ slotProps: { paper: { sx: { maxHeight: 440 } } } }}
      >
        <MenuItem value={NONE}>
          <em>Todas las apps</em>
        </MenuItem>
        {menuOptions.map((option) => (
          <MenuItem key={option.id} value={option.id}>
            {option.label}
            {option.libCount > 0
              ? ` · ${option.libCount} libs`
              : option.techCount > 0
                ? ` · ${option.techCount} tech`
                : ''}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}
