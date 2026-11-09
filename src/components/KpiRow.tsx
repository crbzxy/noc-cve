import BugReportIcon from '@mui/icons-material/BugReport'
import ErrorIcon from '@mui/icons-material/Error'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import { Box, Paper, Stack, Tooltip, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { KEV_COLOR, SEVERITY_COLOR } from '../theme'
import type { CveRecord } from '../types'

function Kpi({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: ReactNode
  label: string
  value: number
  hint?: string
  accent?: string
}) {
  return (
    <Tooltip title={hint ?? ''} disableHoverListener={!hint}>
      <Paper
        variant="outlined"
        sx={{
          flex: '1 1 100px',
          minWidth: 100,
          px: 1.5,
          py: 0.75,
          borderColor: 'divider',
          borderLeft: accent ? `3px solid ${accent}` : undefined,
          bgcolor: 'transparent',
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Box sx={{ color: accent ?? 'text.secondary', display: 'flex', lineHeight: 0 }}>
            {icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {label}
            </Typography>
            <Typography
              component="div"
              sx={{
                fontSize: '1.25rem',
                fontWeight: 700,
                lineHeight: 1.15,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {value.toLocaleString('es-MX')}
            </Typography>
          </Box>
        </Stack>
      </Paper>
    </Tooltip>
  )
}

export function KpiRow({ rows }: { rows: CveRecord[] }) {
  const critical = rows.filter((r) => r.severity === 'CRITICAL').length
  const kev = rows.filter((r) => r.kev).length
  const ransom = rows.filter((r) => r.kev?.ransomware).length
  const hotEpss = rows.filter((r) => (r.epss?.score ?? 0) >= 0.1).length

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'nowrap',
        gap: 1,
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <Kpi
        icon={<BugReportIcon fontSize="small" />}
        label="Total CVEs"
        value={rows.length}
        hint="CVEs únicos tras filtros (misma cifra que la tabla CVEs)"
      />
      <Kpi
        icon={<ErrorIcon fontSize="small" />}
        label="Críticas"
        value={critical}
        accent={SEVERITY_COLOR.CRITICAL}
        hint="CVEs únicos con severidad CRITICAL (no es el número de librerías)"
      />


      <Kpi
        icon={<LocalFireDepartmentIcon fontSize="small" />}
        label="KEV explotadas"
        value={kev}
        accent={KEV_COLOR}
        hint={`CISA KEV · ${ransom} con uso en ransomware`}
      />

      <Kpi
        icon={<TrendingUpIcon fontSize="small" />}
        label="EPSS ≥ 10 %"
        value={hotEpss}
        hint="Probabilidad de explotación a 30 días (EPSS ≥ 10 %)"
      />
    </Box>
  )
}
