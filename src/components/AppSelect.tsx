import CloseIcon from '@mui/icons-material/Close'
import {
  FormControl, IconButton, InputLabel, MenuItem, OutlinedInput, Select, Tooltip, type SelectChangeEvent,
} from '@mui/material'
import { useMemo, useTransition } from 'react'
import { useAppsConfig } from '../hooks/useAppsConfig'
import { resolveAppStackCached } from '../lib/resolveAppStack'
import { useFilters } from '../store/filters'
import { ACCENT_SELECTED, ACCENT_SOFT, PRIMARY, TEXT_STRONG } from '../theme'

const NONE = ''

export function AppSelect({ width = 240 }: { width?: number }) {
  const { options } = useAppsConfig()
  const selectedAppId = useFilters((state) => state.selectedAppId)
  const setSelectedApp = useFilters((state) => state.setSelectedApp)
  const setTechnologies = useFilters((state) => state.setTechnologies)
  const setTechAll = useFilters((state) => state.setTechAll)
  const [isPending, startTransition] = useTransition()

  const menuOptions = useMemo(
    () => options.map((option) => {
      const resolved = resolveAppStackCached(option.id, option.entry)
      // Magento/PHP/WP: activar tech primaria, no DBs auxiliares.
      const filterTechIds = resolved.primaryTechIds.length > 0
        ? resolved.primaryTechIds
        : resolved.techIds
      return {
        id: option.id,
        label: option.label,
        entry: option.entry,
        libCount: resolved.libraries.length,
        techCount: filterTechIds.length,
        techIds: filterTechIds,
      }
    }),
    [options],
  )

  const byId = useMemo(
    () => Object.fromEntries(menuOptions.map((option) => [option.id, option])),
    [menuOptions],
  )

  if (menuOptions.length === 0) return null

  const active = Boolean(selectedAppId && byId[selectedAppId])
  const selectedLabel = selectedAppId ? byId[selectedAppId]?.label : undefined

  const clear = () => {
    startTransition(() => {
      setSelectedApp(null)
      setTechAll(true)
    })
  }

  const onChange = (event: SelectChangeEvent<string>) => {
    const nextId = event.target.value
    if (!nextId) {
      clear()
      return
    }
    startTransition(() => {
      const option = byId[nextId]
      if (!option) return
      setSelectedApp(nextId)
      if (option.techIds.length > 0) setTechnologies(option.techIds)
      else setTechnologies([])
    })
  }

  return (
    <Tooltip title={active && selectedLabel ? selectedLabel : ''} disableHoverListener={!active}>
      <FormControl
        size="small"
        sx={{
          width,
          flexShrink: 0,
          opacity: isPending ? 0.72 : 1,
          transition: 'opacity 120ms ease',
          ...(active && {
            '& .MuiInputLabel-root': { color: 'primary.main', fontWeight: 600 },
            '& .MuiOutlinedInput-root': { bgcolor: ACCENT_SOFT },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main', borderWidth: 2 },
            '& .MuiSelect-select': { fontWeight: 700, color: TEXT_STRONG },
            '& .MuiSelect-icon': { display: 'none' },
          }),
          '& .MuiSelect-select': {
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            pr: active ? 4 : undefined,
          },
        }}
      >
        <InputLabel id="app-select-label">Aplicación</InputLabel>
        <Select
          labelId="app-select-label"
          value={selectedAppId ?? NONE}
          onChange={onChange}
          renderValue={() => selectedLabel ?? 'Todas las apps'}
          IconComponent={active ? () => null : undefined}
          input={(
            <OutlinedInput
              label="Aplicación"
              endAdornment={active ? (
                <Tooltip title="Quitar aplicación">
                  <IconButton
                    size="small"
                    aria-label="Quitar aplicación seleccionada"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation()
                      clear()
                    }}
                    sx={{ position: 'absolute', right: 8, p: 0.25 }}
                  >
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              ) : undefined}
            />
          )}
          MenuProps={{
            slotProps: {
              paper: {
                sx: {
                  maxHeight: 440,
                  minWidth: width,
                  '& .MuiMenuItem-root.Mui-selected': {
                    bgcolor: ACCENT_SELECTED,
                    boxShadow: `inset 3px 0 0 ${PRIMARY}`,
                    fontWeight: 700,
                  },
                },
              },
            },
          }}
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
    </Tooltip>
  )
}
