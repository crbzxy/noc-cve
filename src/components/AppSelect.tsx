import { FormControl, InputLabel, MenuItem, OutlinedInput, Select, type SelectChangeEvent } from '@mui/material'
import { useMemo } from 'react'
import { useAppsConfig } from '../hooks/useAppsConfig'
import { resolveAppStack } from '../lib/resolveAppStack'
import { useFilters } from '../store/filters'

const NONE = ''

export function AppSelect({ minWidth = 260 }: { minWidth?: number }) {
  const { options } = useAppsConfig()
  const selectedAppId = useFilters((state) => state.selectedAppId)
  const setSelectedApp = useFilters((state) => state.setSelectedApp)
  const setTechnologies = useFilters((state) => state.setTechnologies)
  const setTechAll = useFilters((state) => state.setTechAll)

  const byId = useMemo(
    () => Object.fromEntries(options.map((option) => [option.id, option])),
    [options],
  )

  if (options.length === 0) return null

  const onChange = (event: SelectChangeEvent<string>) => {
    const nextId = event.target.value
    if (!nextId) {
      setSelectedApp(null)
      setTechAll(true)
      return
    }
    const option = byId[nextId]
    if (!option) return
    const resolved = resolveAppStack(option.entry)
    setSelectedApp(nextId)
    if (resolved.techIds.length > 0) setTechnologies(resolved.techIds)
    else setTechnologies([])
  }

  return (
    <FormControl size="small" sx={{ minWidth }}>
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
        {options.map((option) => {
          const resolved = resolveAppStack(option.entry)
          return (
            <MenuItem key={option.id} value={option.id}>
              {option.label}
              {resolved.libraries.length > 0
                ? ` · ${resolved.libraries.length} libs`
                : resolved.techIds.length > 0
                  ? ` · ${resolved.techIds.length} tech`
                  : ''}
            </MenuItem>
          )
        })}
      </Select>
    </FormControl>
  )
}
