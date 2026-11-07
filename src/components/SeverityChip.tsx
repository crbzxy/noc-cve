import ErrorIcon from '@mui/icons-material/Error'
import HelpOutlineIcon from '@mui/icons-material/HelpOutlined'
import InfoIcon from '@mui/icons-material/Info'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { Chip } from '@mui/material'
import { SEVERITY_COLOR, SEVERITY_INK, SEVERITY_LABEL } from '../theme'
import type { Severity } from '../types'

export const SEVERITY_ICON: Record<Severity, typeof ErrorIcon> = {
  CRITICAL: ErrorIcon,
  HIGH: ReportProblemIcon,
  MEDIUM: WarningAmberIcon,
  LOW: InfoIcon,
  NONE: HelpOutlineIcon,
}

export function SeverityChip({ severity, size = 'small' }: { severity: Severity; size?: 'small' | 'medium' }) {
  const Icon = SEVERITY_ICON[severity]
  return (
    <Chip
      size={size}
      icon={<Icon style={{ color: SEVERITY_INK[severity] }} />}
      label={SEVERITY_LABEL[severity]}
      sx={{ bgcolor: SEVERITY_COLOR[severity], color: SEVERITY_INK[severity], minWidth: 92, justifyContent: 'flex-start' }}
    />
  )
}
