import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import ErrorIcon from '@mui/icons-material/Error'
import RefreshIcon from '@mui/icons-material/Refresh'
import { CircularProgress, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import type { SourceHealth } from '../hooks/useCves'

const STATUS = {
  ok: { icon: <CheckCircleIcon sx={{ color: '#0ca30c' }} fontSize="small" />, text: 'En línea' },
  error: { icon: <ErrorIcon sx={{ color: '#d03b3b' }} fontSize="small" />, text: 'Error' },
  loading: { icon: <CircularProgress size={16} />, text: 'Consultando…' },
  off: { icon: <CloudOffIcon sx={{ color: '#8a8983' }} fontSize="small" />, text: 'Desactivada' },
}

export function SourceStatus({ health }: { health: SourceHealth[] }) {
  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Estado de fuentes</Typography>
      <Stack spacing={1.25}>
        {health.map((h) => {
          const st = STATUS[h.status]
          return (
            <Stack key={h.id} direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
              {st.icon}
              <Stack sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{h.label}</Typography>
                <Typography variant="caption" color={h.status === 'error' ? 'error.main' : 'text.secondary'} noWrap title={h.error}>
                  {h.status === 'error'
                    ? h.error
                    : `${st.text}${h.count != null ? ` · ${h.count.toLocaleString('es-MX')} registros` : ''}${
                        h.updatedAt ? ` · ${formatDistanceToNow(h.updatedAt, { locale: es, addSuffix: true })}` : ''
                      }`}
                </Typography>
              </Stack>
              {h.status !== 'off' && (
                <Tooltip title="Reintentar">
                  <IconButton size="small" onClick={h.refetch} aria-label={`Reconsultar ${h.label}`}>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          )
        })}
      </Stack>
    </Paper>
  )
}
