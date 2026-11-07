import BugReportIcon from '@mui/icons-material/BugReport'
import ErrorIcon from '@mui/icons-material/Error'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import { Box, Paper, Stack, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { SEVERITY_COLOR } from '../theme'
import type { CveRecord } from '../types'

function Kpi({ icon, label, value, hint, accent }: { icon: ReactNode; label: string; value: number; hint?: string; accent?: string }) {
  return (
    <Paper sx={{ p: 2, flex: 1, minWidth: 180, borderLeft: accent ? `4px solid ${accent}` : undefined }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", color: 'text.secondary' }}>
        {icon}
        <Typography variant="overline" sx={{ lineHeight: 1.2 }}>{label}</Typography>
      </Stack>
      <Typography sx={{ fontSize: '2.4rem', fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
        {value.toLocaleString('es-MX')}
      </Typography>
      {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
    </Paper>
  )
}

export function KpiRow({ rows }: { rows: CveRecord[] }) {
  const critical = rows.filter((r) => r.severity === 'CRITICAL').length
  const kev = rows.filter((r) => r.kev).length
  const ransom = rows.filter((r) => r.kev?.ransomware).length
  const hotEpss = rows.filter((r) => (r.epss?.score ?? 0) >= 0.1).length
  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      <Kpi icon={<BugReportIcon fontSize="small" />} label="CVEs en ventana" value={rows.length} hint="después de filtros" />
      <Kpi icon={<ErrorIcon fontSize="small" />} label="Críticas" value={critical} accent={SEVERITY_COLOR.CRITICAL} hint="CVSS ≥ 9.0" />
      <Kpi icon={<LocalFireDepartmentIcon fontSize="small" />} label="Explotadas (KEV)" value={kev} accent={SEVERITY_COLOR.HIGH} hint={`${ransom} con uso en ransomware`} />
      <Kpi icon={<TrendingUpIcon fontSize="small" />} label="EPSS ≥ 10 %" value={hotEpss} hint="prob. de explotación a 30 días" />
    </Box>
  )
}
