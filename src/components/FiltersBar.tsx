import SearchIcon from '@mui/icons-material/Search'
import {
  Checkbox, Chip, FormControl, FormControlLabel, InputAdornment, InputLabel, ListItemText,
  MenuItem, OutlinedInput, Paper, Select, Stack, Switch, TextField,
  ToggleButton, ToggleButtonGroup, Typography, type SelectChangeEvent,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useSourcesConfig } from '../hooks/useSourcesConfig'
import { useFilters, type WindowDays } from '../store/filters'
import { SEVERITY_LABEL } from '../theme'
import { SEVERITIES, SOURCES, isSourceId, type SourceId } from '../types'
import { SEVERITY_ICON } from './SeverityChip'

const WINDOWS: WindowDays[] = [1, 3, 7, 14, 30]
const ALL_TECH = '__all__'

export function FiltersBar() {
  const f = useFilters()
  const { config } = useSourcesConfig()
  const [q, setQ] = useState(f.search)

  useEffect(() => {
    const t = setTimeout(() => f.setSearch(q), 200)
    return () => clearTimeout(t)
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  const filterSources = config.sources.filter(
    (source) => source.role !== 'score' && isSourceId(source.id) && source.enabled,
  )

  const techOptions = config.technologies
  const techIds = useMemo(() => techOptions.map((tech) => tech.id), [techOptions])
  const allSelected = f.techAll
  const selectedTech = f.technologies.filter((id) => techIds.includes(id))
  // Con «Todas» el valor del Select es solo ese ítem; al desmarcarlo queda vacío
  const selectValue = allSelected ? [ALL_TECH] : selectedTech

  const techLabelById = useMemo(
    () => Object.fromEntries(techOptions.map((tech) => [tech.id, tech.label])),
    [techOptions],
  )

  const onTechChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value
    const next = typeof value === 'string' ? value.split(',') : value
    const withoutAll = next.filter((id) => id !== ALL_TECH)

    if (allSelected) {
      // Estaba en Todas: desmarcar Todas → vacío; o clic en una tech → solo esa
      f.setTechAll(false)
      f.setTechnologies(withoutAll)
      return
    }

    if (next.includes(ALL_TECH)) {
      f.setTechAll(true)
      return
    }

    f.setTechnologies(withoutAll)
  }

  const renderTechValue = (selected: string[]) => {
    if (allSelected || selected.includes(ALL_TECH)) return 'Todas'
    if (selected.length === 0) return 'Ninguna'
    if (selected.length <= 2) {
      return selected.map((id) => techLabelById[id] ?? id).join(', ')
    }
    return `${selected.length} tecnologías`
  }

  return (
    <Paper sx={{ p: 1.5 }}>
      <Stack direction="row" spacing={2} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <ToggleButtonGroup size="small" exclusive value={f.days} onChange={(_, v) => v && f.setDays(v)} aria-label="Ventana de tiempo">
          {WINDOWS.map((d) => (
            <ToggleButton key={d} value={d} sx={{ px: 1.5 }}>{d === 1 ? '24 h' : `${d} d`}</ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          {SEVERITIES.map((s) => {
            const Icon = SEVERITY_ICON[s]
            const on = f.severities.includes(s)
            return (
              <Chip
                key={s}
                size="small"
                icon={<Icon />}
                label={SEVERITY_LABEL[s]}
                variant={on ? 'filled' : 'outlined'}
                onClick={() => f.toggleSeverity(s)}
                aria-pressed={on}
              />
            )
          })}
        </Stack>

        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">Fuentes</Typography>
          {(filterSources.length > 0 ? filterSources : SOURCES.map((id) => ({ id, label: id }))).map((source) => {
            const id = source.id as SourceId
            const on = f.sources.includes(id)
            return (
              <Chip
                key={id}
                size="small"
                label={source.label}
                color={on ? 'primary' : 'default'}
                variant={on ? 'filled' : 'outlined'}
                onClick={() => f.toggleSource(id)}
              />
            )
          })}
        </Stack>

        <FormControlLabel
          control={<Switch size="small" checked={f.stackOnly} onChange={(e) => f.setStackOnly(e.target.checked)} />}
          label={<Typography variant="body2">Solo stack</Typography>}
        />

        <FormControlLabel
          control={<Switch size="small" checked={f.kevOnly} onChange={(e) => f.setKevOnly(e.target.checked)} />}
          label={<Typography variant="body2">Solo explotadas</Typography>}
        />

        {techOptions.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="tech-multiselect-label">Tecnologías</InputLabel>
            <Select
              labelId="tech-multiselect-label"
              multiple
              value={selectValue}
              onChange={onTechChange}
              input={<OutlinedInput label="Tecnologías" />}
              renderValue={renderTechValue}
              MenuProps={{ slotProps: { paper: { sx: { maxHeight: 360 } } } }}
            >
              <MenuItem value={ALL_TECH} dense>
                <Checkbox
                  size="small"
                  checked={allSelected}
                  indeterminate={!allSelected && selectedTech.length > 0}
                />
                <ListItemText
                  primary="Todas"
                  secondary={allSelected ? 'Clic para limpiar y elegir' : 'Seleccionar todas'}
                />
              </MenuItem>
              {techOptions.map((tech) => (
                <MenuItem key={tech.id} value={tech.id} dense>
                  <Checkbox size="small" checked={!allSelected && selectedTech.includes(tech.id)} />
                  <ListItemText primary={tech.label} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <TextField
          select size="small" label="EPSS mín." value={f.minEpss}
          onChange={(e) => f.setMinEpss(Number(e.target.value))} sx={{ width: 120 }}
        >
          {[0, 0.01, 0.05, 0.1, 0.5].map((v) => (
            <MenuItem key={v} value={v}>{v === 0 ? 'Todos' : `≥ ${v * 100} %`}</MenuItem>
          ))}
        </TextField>

        <TextField
          select size="small" label="Refresco" value={f.refreshMin}
          onChange={(e) => f.setRefreshMin(Number(e.target.value))} sx={{ width: 120 }}
        >
          {[0, 5, 15, 30, 60].map((v) => (
            <MenuItem key={v} value={v}>{v === 0 ? 'Manual' : `${v} min`}</MenuItem>
          ))}
        </TextField>

        <TextField
          size="small"
          placeholder="CVE, GHSA, paquete, vendor, tech…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ flex: 1, minWidth: 220 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        />
      </Stack>
    </Paper>
  )
}
