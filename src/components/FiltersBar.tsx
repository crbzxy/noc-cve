import {
  Alert, Box, ButtonBase, Checkbox, FormControl, FormControlLabel, InputLabel, ListItemText, MenuItem,
  OutlinedInput, Select, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material'
import { useSourcesConfig } from '../hooks/useSourcesConfig'
import { useFilters, type WindowDays } from '../store/filters'
import {
  BORDER, BORDER_STRONG, SEGMENT_SELECTED, SEVERITY_COLOR, SEVERITY_LABEL, SURFACE, SURFACE_SUNKEN, TEXT_STRONG,
} from '../theme'
import { SEVERITIES, SOURCES, isSourceId, type SourceId } from '../types'
import { TechnologySelect } from './TechnologySelect'

const WINDOWS: WindowDays[] = [1, 7, 15, 30, 90]

function windowLabel(days: WindowDays): string {
  if (days === 1) return '24 h'
  if (days === 90) return '3 m'
  return `${days} d`
}

function Separator() {
  return <Box aria-hidden sx={{ width: '1px', height: 28, bgcolor: BORDER_STRONG, display: { xs: 'none', md: 'block' } }} />
}

export function FiltersBar({
  kevUnavailable = false,
  kevFilterAvailable = true,
  windowFallbackHint = null,
}: {
  kevUnavailable?: boolean
  /** false cuando CISA/VulnCheck KEV están off o caídos: no mostrar el switch. */
  kevFilterAvailable?: boolean
  windowFallbackHint?: string | null
}) {
  const f = useFilters()
  const { config } = useSourcesConfig()

  const filterSources = config.sources.filter(
    (source) => source.role !== 'score' && isSourceId(source.id) && source.enabled,
  )
  const sourceOptions = (filterSources.length > 0 ? filterSources : SOURCES.map((id) => ({ id, label: id })))
    .map((source) => ({ id: source.id as SourceId, label: source.label }))
  const activeSources = f.sources.filter((id) => sourceOptions.some((option) => option.id === id))

  return (
    <Box
      component="section"
      aria-label="Filtros"
      sx={{
        p: 1.25,
        bgcolor: SURFACE_SUNKEN,
        border: `1px solid ${BORDER}`,
        borderRadius: '12px',
      }}
    >
      {windowFallbackHint && (
        <Alert
          severity="info"
          sx={{ mb: 1.25, py: 0, '& .MuiAlert-message': { py: 0.75, fontSize: 13 } }}
        >
          {windowFallbackHint}
        </Alert>
      )}
      <Stack direction="row" spacing={1.25} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Tooltip
          title={
            f.selectedAppId
              ? 'Con app: la ventana filtra el inventario, pero CRITICAL/HIGH de tus libs se mantienen siempre (versión sin parche).'
              : 'Ventana de noticias: CVE publicados/modificados en ese periodo. Si no hay hallazgos, se amplía a 3 meses.'
          }
        >
          <ToggleButtonGroup
            size="small"
            exclusive
            value={f.days}
            onChange={(_, v) => v && f.setDays(v)}
            aria-label="Ventana de tiempo"
            sx={{
              bgcolor: SURFACE,
              border: `1px solid ${BORDER_STRONG}`,
              borderRadius: '9px',
              p: '3px',
              '& .MuiToggleButton-root': {
                border: 0,
                borderRadius: '7px !important',
                px: 1.5,
                py: 0.5,
                fontWeight: 600,
                fontSize: 13,
                textTransform: 'none',
                color: 'text.secondary',
              },
              '& .Mui-selected': { bgcolor: `${SEGMENT_SELECTED} !important`, color: `${TEXT_STRONG} !important` },
            }}
          >
            {WINDOWS.map((d) => (
              <ToggleButton key={d} value={d}>{windowLabel(d)}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Tooltip>

        <Separator />

        <Stack direction="row" spacing={0.75} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          {SEVERITIES.map((s) => {
            const on = f.severities.includes(s)
            const tone = SEVERITY_COLOR[s]
            return (
              <ButtonBase
                key={s}
                onClick={() => f.toggleSeverity(s)}
                aria-pressed={on}
                sx={{
                  height: 32,
                  px: 1.5,
                  gap: 0.875,
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 500,
                  border: '1px solid',
                  borderColor: on ? tone : BORDER_STRONG,
                  bgcolor: on ? `${tone}1f` : SURFACE,
                  color: on ? 'text.primary' : 'text.secondary',
                  opacity: on ? 1 : 0.7,
                  '&:hover': { borderColor: tone, opacity: 1 },
                }}
              >
                <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: tone }} />
                {SEVERITY_LABEL[s]}
              </ButtonBase>
            )
          })}
        </Stack>

        <Separator />

        <TechnologySelect minWidth={180} />

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel id="sources-select-label">Fuentes</InputLabel>
          <Select
            labelId="sources-select-label"
            multiple
            value={activeSources}
            onChange={(event) => {
              const next = (typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value)
                .filter(isSourceId)
              for (const option of sourceOptions) {
                if (next.includes(option.id) !== f.sources.includes(option.id)) f.toggleSource(option.id)
              }
            }}
            input={<OutlinedInput label="Fuentes" />}
            renderValue={(selected) => (selected.length === sourceOptions.length ? `Todas (${selected.length})` : `${selected.length}`)}
          >
            {sourceOptions.map((option) => (
              <MenuItem key={option.id} value={option.id} dense>
                <Checkbox size="small" checked={f.sources.includes(option.id)} />
                <ListItemText primary={option.label} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          select size="small" label="EPSS mín." value={f.minEpss}
          onChange={(e) => f.setMinEpss(Number(e.target.value))} sx={{ width: 120 }}
        >
          {[0, 0.01, 0.05, 0.1, 0.5].map((v) => (
            <MenuItem key={v} value={v}>{v === 0 ? 'Todos' : `≥ ${v * 100} %`}</MenuItem>
          ))}
        </TextField>

        {kevFilterAvailable && (
          <Tooltip
            title={
              kevUnavailable
                ? 'La fuente KEV no respondió: este filtro no puede marcar explotadas. Revisa Fuentes (sidebar) y recarga el corpus.'
                : 'Solo CVE en CISA/VulnCheck KEV (explotación conocida en el mundo real). Si la fuente KEV está caída, la lista queda vacía.'
            }
          >
            <FormControlLabel
              sx={{ ml: { md: 'auto' }, mr: 0.5 }}
              control={(
                <Switch
                  size="small"
                  color={kevUnavailable && f.kevOnly ? 'warning' : 'primary'}
                  checked={f.kevOnly}
                  onChange={(e) => f.setKevOnly(e.target.checked)}
                />
              )}
              label={(
                <Typography variant="body2" color={kevUnavailable && f.kevOnly ? 'warning.main' : undefined}>
                  Solo explotadas{kevUnavailable && f.kevOnly ? ' (KEV caído)' : ''}
                </Typography>
              )}
            />
          </Tooltip>
        )}
      </Stack>
    </Box>
  )
}
