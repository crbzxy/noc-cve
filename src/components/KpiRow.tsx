import { Box, ButtonBase, Skeleton, Stack, Tooltip, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { useFilters } from '../store/filters'
import { BORDER, BORDER_STRONG, KEV_COLOR, SEVERITY_COLOR, SEVERITY_TEXT, SURFACE } from '../theme'
import { SEVERITIES, type CveRecord } from '../types'

const CARD_SX = {
  flex: '1 1 180px',
  minWidth: 160,
  px: 2,
  py: 1.5,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: 0.5,
  textAlign: 'left',
  bgcolor: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: '12px',
} as const

function Value({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <Typography
      component="span"
      sx={{
        fontSize: 28,
        fontWeight: 700,
        lineHeight: 1.2,
        letterSpacing: '-0.02em',
        fontVariantNumeric: 'tabular-nums',
        color: muted ? 'text.disabled' : 'text.primary',
      }}
    >
      {children}
    </Typography>
  )
}

function Label({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <Stack
      direction="row"
      spacing={0.75}
      component="span"
      sx={{ alignItems: 'center', fontSize: 12, fontWeight: color ? 600 : 500, color: color ?? 'text.secondary' }}
    >
      {children}
    </Stack>
  )
}

function Dot({ color }: { color: string }) {
  return <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
}

const KPI_LABELS = ['Total CVEs', 'Críticas', 'KEV explotadas', 'EPSS ≥ 10 %']

function KpiSkeleton() {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, width: '100%' }} aria-busy aria-label="Cargando indicadores">
      {KPI_LABELS.map((label) => (
        <Box key={label} sx={CARD_SX}>
          <Label>{label}</Label>
          {/* Mismo alto que Value (28px · 1.2) para que la fila no salte al llegar los datos. */}
          <Skeleton variant="rounded" width={72} height={34} />
        </Box>
      ))}
    </Box>
  )
}

export function KpiRow({
  rows,
  kevUnavailable = false,
  loading = false,
}: {
  rows: CveRecord[]
  kevUnavailable?: boolean
  loading?: boolean
}) {
  const severities = useFilters((s) => s.severities)
  const setSeverities = useFilters((s) => s.setSeverities)
  if (loading) return <KpiSkeleton />
  const critical = rows.filter((r) => r.severity === 'CRITICAL').length
  const kev = rows.filter((r) => r.kev).length
  const ransom = rows.filter((r) => r.kev?.ransomware).length
  const withEpss = rows.filter((r) => r.epss).length
  const hotEpss = rows.filter((r) => (r.epss?.score ?? 0) >= 0.1).length
  const criticalOnly = severities.length === 1 && severities[0] === 'CRITICAL'

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, width: '100%' }}>
      <Tooltip title="CVEs únicos tras filtros (misma cifra que la tabla CVEs)">
        <Box sx={CARD_SX}>
          <Label>Total CVEs</Label>
          <Value>{rows.length.toLocaleString('es-MX')}</Value>
        </Box>
      </Tooltip>

      <Tooltip title={criticalOnly ? 'Mostrar todas las severidades' : 'Filtrar solo críticas'}>
        <ButtonBase
          onClick={() => setSeverities(criticalOnly ? [...SEVERITIES] : ['CRITICAL'])}
          aria-pressed={criticalOnly}
          sx={{
            ...CARD_SX,
            borderColor: criticalOnly ? SEVERITY_COLOR.CRITICAL : BORDER,
            '&:hover': { borderColor: SEVERITY_COLOR.CRITICAL },
          }}
        >
          <Label color={SEVERITY_TEXT.CRITICAL}><Dot color={SEVERITY_COLOR.CRITICAL} />Críticas</Label>
          <Value>{critical.toLocaleString('es-MX')}</Value>
        </ButtonBase>
      </Tooltip>

      <Tooltip title={kevUnavailable ? 'La fuente KEV no respondió; el conteo no es confiable' : `CISA KEV · ${ransom} con uso en ransomware`}>
        <Box sx={{ ...CARD_SX, ...(kevUnavailable ? { borderStyle: 'dashed', borderColor: BORDER_STRONG } : {}) }}>
          <Label>{!kevUnavailable && <Dot color={KEV_COLOR} />}KEV explotadas</Label>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'baseline' }}>
            <Value muted={kevUnavailable}>{kevUnavailable ? '—' : kev.toLocaleString('es-MX')}</Value>
            {kevUnavailable && <Typography variant="caption" sx={{ color: 'warning.main' }}>Fuente no disponible</Typography>}
          </Stack>
        </Box>
      </Tooltip>

      <Tooltip title="Probabilidad de explotación a 30 días (EPSS ≥ 10 %)">
        <Box sx={CARD_SX}>
          <Label>EPSS ≥ 10 %</Label>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'baseline' }}>
            <Value>{hotEpss.toLocaleString('es-MX')}</Value>
            <Typography variant="caption" color="text.secondary">
              {withEpss.toLocaleString('es-MX')} con puntaje
            </Typography>
          </Stack>
        </Box>
      </Tooltip>
    </Box>
  )
}
