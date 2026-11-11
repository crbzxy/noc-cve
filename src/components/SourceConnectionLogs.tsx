import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, Stack, Tooltip, Typography,
} from '@mui/material'
import { useState } from 'react'
import type { SourceHealth } from '../hooks/useCves'
import { BORDER, SURFACE_SUNKEN } from '../theme'

function buildLogsText(health: SourceHealth[]): string {
  const lines = health.map((source) => {
    const status = source.status.toUpperCase()
    const count = source.count != null ? ` · count=${source.count}` : ''
    const url = source.baseUrl ? ` · ${source.baseUrl}` : ''
    const error = source.error ? `\n  ${source.error}` : ''
    return `[${status}] ${source.label}${count}${url}${error}`
  })
  return lines.join('\n\n')
}

function SourceLogBlock({ source }: { source: SourceHealth }) {
  const isError = source.status === 'error'
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: '8px',
        bgcolor: SURFACE_SUNKEN,
        border: `1px solid ${BORDER}`,
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {source.label}
        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
          {source.status}
          {source.count != null ? ` · ${source.count.toLocaleString('es-MX')}` : ''}
        </Typography>
      </Typography>
      {source.baseUrl && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {source.baseUrl}
        </Typography>
      )}
      <Typography
        variant="body2"
        color={isError ? 'error.main' : 'text.secondary'}
        sx={{ mt: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
      >
        {isError
          ? (source.error || 'Error sin detalle')
          : source.status === 'ok'
            ? 'Conecta correctamente.'
            : source.status === 'loading'
              ? 'Consultando…'
              : 'Fuente desactivada.'}
      </Typography>
    </Box>
  )
}

/** Modal con el detalle de por qué cada fuente conecta o falla. */
export function SourceConnectionLogs({
  open,
  health,
  onClose,
}: {
  open: boolean
  health: SourceHealth[]
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const failing = health.filter((source) => source.status === 'error')

  const copyLogs = async () => {
    try {
      await navigator.clipboard.writeText(buildLogsText(health))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="source-logs-title">
      <DialogTitle id="source-logs-title" sx={{ pr: 1 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Box sx={{ flex: 1 }}>
            Logs de conexión
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {failing.length > 0
                ? `${failing.length} fuente(s) con error · por qué no conectan`
                : 'Todas las fuentes respondieron sin error de red'}
            </Typography>
          </Box>
          <Tooltip title={copied ? 'Copiado' : 'Copiar logs'}>
            <IconButton size="small" onClick={() => void copyLogs()} aria-label="Copiar logs">
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 2 }}>
        {(failing.length > 0 ? failing : health).map((source) => (
          <SourceLogBlock key={source.id} source={source} />
        ))}
        {failing.length > 0 && failing.length < health.length && (
          <Typography variant="caption" color="text.secondary">
            Mostrando solo errores. Hay {health.length - failing.length} fuente(s) en línea.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained">Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}
