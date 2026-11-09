import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import ErrorIcon from '@mui/icons-material/Error'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import RefreshIcon from '@mui/icons-material/Refresh'
import { Box, CircularProgress, Divider, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import type { SourceHealth } from '../hooks/useCves'

const STATUS = {
  ok: { icon: <CheckCircleIcon color="success" fontSize="small" />, text: 'En línea' },
  error: { icon: <ErrorIcon color="error" fontSize="small" />, text: 'Error' },
  loading: { icon: <CircularProgress size={16} />, text: 'Consultando…' },
  off: { icon: <CloudOffIcon sx={{ color: 'text.disabled' }} fontSize="small" />, text: 'Off' },
}

export function SourceStatus({
  health,
  onClose,
}: {
  health: SourceHealth[]
  onClose?: () => void
}) {
  return (
    <Stack spacing={0} sx={{ height: '100%' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 2, pt: 2, pb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
          Fuentes
        </Typography>
        {onClose && (
          <Tooltip title="Cerrar panel">
            <IconButton size="small" onClick={onClose} aria-label="Cerrar panel de fuentes">
              <MenuOpenIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      <Divider />
      <Stack spacing={0} sx={{ flex: 1, overflow: 'auto' }}>
        {health.map((h, index) => {
          const st = STATUS[h.status]
          return (
            <Box key={h.id}>
              {index > 0 && <Divider />}
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', px: 2, py: 1.5 }}>
                <Box sx={{ mt: 0.25 }}>{st.icon}</Box>
                <Stack sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <Tooltip title={h.baseUrl ?? ''} disableHoverListener={!h.baseUrl}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                        {h.label}
                      </Typography>
                    </Tooltip>
                    {h.status !== 'off' && (
                      <Tooltip title="Reintentar">
                        <IconButton
                          size="small"
                          onClick={h.refetch}
                          aria-label={`Reconsultar ${h.label}`}
                          sx={{ ml: 'auto', flexShrink: 0 }}
                        >
                          <RefreshIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                  <Typography
                    variant="caption"
                    color={h.status === 'error' ? 'error.main' : 'text.secondary'}
                    sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                    title={h.error ?? h.baseUrl}
                  >
                    {h.status === 'error'
                      ? h.error
                      : `${st.text}${h.count != null ? ` · ${h.count.toLocaleString('es-MX')}` : ''}`}
                  </Typography>
                  {h.updatedAt && h.status !== 'error' && (
                    <Typography variant="caption" color="text.disabled" noWrap>
                      {formatDistanceToNow(h.updatedAt, { locale: es, addSuffix: true })}
                    </Typography>
                  )}
                </Stack>
              </Stack>
            </Box>
          )
        })}
      </Stack>
    </Stack>
  )
}
