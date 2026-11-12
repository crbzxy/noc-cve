import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Box, IconButton, Paper, Stack, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { MONO } from '../theme'

export function ExpandableModule({
  id,
  title,
  count,
  open,
  onToggle,
  trailing,
  children,
  defaultHeight = 220,
  fixedHeight,
}: {
  id: string
  title: string
  count?: number | string
  open: boolean
  onToggle: () => void
  trailing?: ReactNode
  children: ReactNode
  /** Alto preferido al expandir (flex-basis). */
  defaultHeight?: number
  /**
   * Alto fijo del contenido al abrir.
   * Si hay espacio, el módulo puede crecer por encima (flex-grow).
   */
  fixedHeight?: number
}) {
  const basis = fixedHeight ?? defaultHeight

  return (
    <Paper
      id={id}
      sx={{
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        flex: open ? `1 1 ${basis}px` : '0 0 auto',
        ...(open && fixedHeight
          ? { minHeight: fixedHeight + 40 }
          : open
            ? { minHeight: 0, height: '100%' }
            : { minHeight: 0, height: 'auto' }),
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={`${id}-body`}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onToggle()
          }
        }}
        sx={{
          alignItems: 'center',
          px: 1.5,
          py: 0.75,
          flexShrink: 0,
          cursor: 'pointer',
          borderBottom: open ? 1 : 0,
          borderColor: 'divider',
          userSelect: 'none',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {count != null && (
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: MONO }}>
            {count}
          </Typography>
        )}
        {trailing}
        <Box sx={{ flex: 1 }} />
        <IconButton
          size="small"
          component="span"
          tabIndex={-1}
          aria-hidden
          sx={{ pointerEvents: 'none' }}
        >
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Stack>

      {open && (
        <Box
          id={`${id}-body`}
          sx={{
            minHeight: fixedHeight ?? 0,
            height: fixedHeight ? '100%' : undefined,
            flex: 1,
            overflow: 'hidden',
          }}
        >
          {children}
        </Box>
      )}
    </Paper>
  )
}
