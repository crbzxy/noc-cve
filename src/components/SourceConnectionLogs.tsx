import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, Stack, Tooltip, Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
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

/** Fallback para HTTP (QA): Clipboard API solo funciona en contexto seguro. */
function copyTextWithExecCommand(text: string): boolean {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.left = '-9999px'
  area.style.top = '0'
  document.body.appendChild(area)
  area.focus()
  area.select()
  area.setSelectionRange(0, area.value.length)
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(area)
  return ok
}

async function copyLogsText(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // cae al fallback
    }
  }
  return copyTextWithExecCommand(text)
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
              : (source.error || 'Fuente desactivada.')}
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
  const visible = failing.length > 0 ? failing : health

  useEffect(() => {
    if (!open) setCopied(false)
  }, [open])

  const copyLogs = async () => {
    const ok = await copyLogsText(buildLogsText(visible))
    if (!ok) {
      setCopied(false)
      return
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
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
          <Tooltip title={copied ? 'Copiado al portapapeles' : 'Copiar logs'}>
            <IconButton
              size="small"
              color={copied ? 'success' : 'default'}
              onClick={() => void copyLogs()}
              aria-label={copied ? 'Logs copiados' : 'Copiar logs'}
            >
              {copied
                ? <CheckCircleIcon fontSize="small" color="success" />
                : <ContentCopyIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 2 }}>
        {visible.map((source) => (
          <SourceLogBlock key={source.id} source={source} />
        ))}
        {failing.length > 0 && failing.length < health.length && (
          <Typography variant="caption" color="text.secondary">
            Mostrando solo errores. Hay {health.length - failing.length} fuente(s) en línea.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={() => void copyLogs()}
          color={copied ? 'success' : 'primary'}
          startIcon={copied ? <CheckCircleIcon /> : <ContentCopyIcon />}
        >
          {copied ? 'Copiado' : 'Copiar logs'}
        </Button>
        <Button onClick={onClose} variant="contained">Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}
