import SearchIcon from '@mui/icons-material/Search'
import {
  Chip, FormControlLabel, InputAdornment, MenuItem, Paper, Stack, Switch, TextField,
  ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { useSourcesConfig } from '../hooks/useSourcesConfig'
import { useFilters, type WindowDays } from '../store/filters'
import { SEVERITY_COLOR, SEVERITY_INK, SEVERITY_LABEL } from '../theme'
import { SEVERITIES, SOURCES, isSourceId, type SourceId } from '../types'
import { SEVERITY_ICON } from './SeverityChip'

const WINDOWS: WindowDays[] = [1, 7, 15, 30, 90]

const SOURCE_SHORT: Partial<Record<SourceId, string>> = {
  nvd: 'NVD',
  kev: 'KEV',
  github: 'GH',
  cveorg: 'CVE',
  osv: 'OSV',
  euvd: 'EUVD',
  'vulncheck-kev': 'VC',
  wordfence: 'WF',
}

function windowLabel(days: WindowDays): string {
  if (days === 1) return '24 h'
  if (days === 90) return '3 meses'
  return `${days} d`
}

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

  return (
    <Paper sx={{ p: 1, flexShrink: 0 }}>
      <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Tooltip
          title={
            f.selectedAppId
              ? 'Con app: la ventana filtra el inventario, pero CRITICAL/HIGH de tus libs se mantienen siempre (versión sin parche).'
              : 'Ventana de noticias: CVE publicados/modificados en ese periodo.'
          }
        >
          <ToggleButtonGroup
            size="small"
            exclusive
            value={f.days}
            onChange={(_, v) => v && f.setDays(v)}
            aria-label="Ventana de tiempo"
          >
            {WINDOWS.map((d) => (
              <ToggleButton key={d} value={d} sx={{ px: 1.5 }}>{windowLabel(d)}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Tooltip>

        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          {SEVERITIES.map((s) => {
            const Icon = SEVERITY_ICON[s]
            const on = f.severities.includes(s)
            const tone = SEVERITY_COLOR[s]
            const ink = SEVERITY_INK[s]
            return (
              <Chip
                key={s}
                size="small"
                icon={<Icon sx={{ color: `${on ? ink : tone} !important` }} />}
                label={SEVERITY_LABEL[s]}
                variant={on ? 'filled' : 'outlined'}
                onClick={() => f.toggleSeverity(s)}
                aria-pressed={on}
                sx={on
                  ? { bgcolor: tone, color: ink, borderColor: tone, '&:hover': { bgcolor: tone, filter: 'brightness(1.08)' } }
                  : { color: tone, borderColor: tone, '&:hover': { bgcolor: `${tone}22` } }}
              />
            )
          })}
        </Stack>

        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          {(filterSources.length > 0 ? filterSources : SOURCES.map((id) => ({ id, label: id }))).map((source) => {
            const id = source.id as SourceId
            const on = f.sources.includes(id)
            const short = SOURCE_SHORT[id] ?? source.label
            return (
              <Tooltip key={id} title={source.label}>
                <Chip
                  size="small"
                  label={short}
                  color={on ? 'primary' : 'default'}
                  variant={on ? 'filled' : 'outlined'}
                  onClick={() => f.toggleSource(id)}
                />
              </Tooltip>
            )
          })}
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
          select size="small" label="Actualización" value={f.refreshMin}
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
