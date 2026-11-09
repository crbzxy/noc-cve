import BugReportIcon from '@mui/icons-material/BugReport'
import ErrorIcon from '@mui/icons-material/Error'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import { Box, Paper, Stack, Tooltip, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { SEVERITY_COLOR } from '../theme'
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
          flex: '1 1 140px',
          minWidth: 140,
          px: 2,
          py: 1.5,
          borderLeft: accent ? `3px solid ${accent}` : undefined,
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
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
                fontSize: '1.5rem',
                fontWeight: 700,
                lineHeight: 1.2,
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
        flexWrap: 'wrap',
        gap: 1.5,
        width: '100%',
      }}
    >
      <Kpi icon={<BugReportIcon fontSize="small" />} label="En ventana" value={rows.length} hint="CVEs tras filtros" />
      <Kpi
        icon={<ErrorIcon fontSize="small" />}
        label="Críticas"
        value={critical}
        accent={SEVERITY_COLOR.CRITICAL}
        hint="Severidad CRITICAL"
      />
      <Kpi
        icon={<LocalFireDepartmentIcon fontSize="small" />}
        label="KEV"
        value={kev}
        accent={SEVERITY_COLOR.HIGH}
        hint={`${ransom} con uso en ransomware`}
      />
      <Kpi
        icon={<TrendingUpIcon fontSize="small" />}
        label="EPSS ≥ 10 %"
        value={hotEpss}
        hint="Probabilidad de explotación a 30 días"
      />
    </Box>
  )
}
