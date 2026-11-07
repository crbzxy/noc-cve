import SearchIcon from '@mui/icons-material/Search'
import {
  Chip, FormControlLabel, InputAdornment, MenuItem, Paper, Stack, Switch, TextField,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { useFilters, type WindowDays } from '../store/filters'
import { SEVERITY_LABEL } from '../theme'
import { SEVERITIES, SOURCES, type SourceId } from '../types'
import { SEVERITY_ICON } from './SeverityChip'

const SOURCE_LABEL: Record<SourceId, string> = { nvd: 'NVD', kev: 'CISA KEV', github: 'GitHub' }
const WINDOWS: WindowDays[] = [1, 3, 7, 14, 30]

export function FiltersBar() {
  const f = useFilters()
  // Debounce de la búsqueda para no recalcular la tabla en cada tecla
  const [q, setQ] = useState(f.search)
  useEffect(() => {
    const t = setTimeout(() => f.setSearch(q), 200)
    return () => clearTimeout(t)
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Paper sx={{ p: 1.5 }}>
      <Stack direction="row" spacing={2} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <ToggleButtonGroup size="small" exclusive value={f.days} onChange={(_, v) => v && f.setDays(v)} aria-label="Ventana de tiempo">
          {WINDOWS.map((d) => (
            <ToggleButton key={d} value={d} sx={{ px: 1.5 }}>{d === 1 ? '24 h' : `${d} d`}</ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
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

        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
          <Typography variant="caption" color="text.secondary">Fuentes</Typography>
          {SOURCES.map((s) => (
            <Chip
              key={s}
              size="small"
              label={SOURCE_LABEL[s]}
              color={f.sources.includes(s) ? 'primary' : 'default'}
              variant={f.sources.includes(s) ? 'filled' : 'outlined'}
              onClick={() => f.toggleSource(s)}
            />
          ))}
        </Stack>

        <FormControlLabel
          control={<Switch size="small" checked={f.kevOnly} onChange={(e) => f.setKevOnly(e.target.checked)} />}
          label={<Typography variant="body2">Solo explotadas</Typography>}
        />

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
          placeholder="CVE, GHSA, paquete, vendor…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ flex: 1, minWidth: 220 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        />
      </Stack>
    </Paper>
  )
}
