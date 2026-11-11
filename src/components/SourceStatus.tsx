import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import ErrorIcon from '@mui/icons-material/Error'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import RefreshIcon from '@mui/icons-material/Refresh'
import { Box, ButtonBase, CircularProgress, Divider, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import type { SourceHealth } from '../hooks/useCves'
import { BORDER_STRONG, SOURCE_OFF, SURFACE } from '../theme'

const STATUS = {
  ok: { icon: <CheckCircleIcon color="success" fontSize="small" />, text: 'En línea' },
  error: { icon: <ErrorIcon color="error" fontSize="small" />, text: 'Error' },
  loading: { icon: <CircularProgress size={16} />, text: 'Consultando…' },
  off: { icon: <CloudOffIcon sx={{ color: 'text.disabled' }} fontSize="small" />, text: 'Off' },
}

const PILL_COLOR: Record<SourceHealth['status'], string> = {
  ok: '#22c55e',
  loading: '#f5a524',
  error: '#f05252',
  off: SOURCE_OFF,
}

/** Resumen compacto del header: una barra por fuente; abre/cierra el panel lateral. */
export function SourceHealthPill({
  health,
  open,
  onToggle,
}: {
  health: SourceHealth[]
  open: boolean
  onToggle: () => void
}) {
  const online = health.filter((h) => h.status === 'ok').length
  const failing = health.filter((h) => h.status === 'error')
  const tooltip = failing.length > 0
    ? `Con error: ${failing.map((h) => h.label).join(', ')}`
    : 'Estado de las fuentes'

  return (
    <Tooltip title={tooltip}>
      <ButtonBase
        onClick={onToggle}
        aria-expanded={open}
        aria-label={`Fuentes: ${online} de ${health.length} en línea. ${open ? 'Cerrar' : 'Abrir'} panel`}
        sx={{
          height: 38,
          px: 1.5,
          gap: 1,
          borderRadius: '10px',
          border: 1,
          borderColor: failing.length > 0 && !open ? 'error.main' : BORDER_STRONG,
          bgcolor: open ? 'action.selected' : SURFACE,
          fontSize: 13,
          whiteSpace: 'nowrap',
        }}
      >
        <Stack direction="row" spacing="3px" aria-hidden>
          {health.map((h) => (
            <Box key={h.id} sx={{ width: 6, height: 14, borderRadius: '2px', bgcolor: PILL_COLOR[h.status] }} />
          ))}
        </Stack>
        <span>
          Fuentes <strong>{online}/{health.length}</strong> en línea
        </span>
        <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.secondary', transform: open ? 'rotate(180deg)' : 'none' }} />
      </ButtonBase>
    </Tooltip>
  )
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
                      : `${st.text}${h.count != null ? ` · ${h.count.toLocaleString('es-MX')}` : ''}${h.detail ? ` · ${h.detail}` : ''}`}
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
