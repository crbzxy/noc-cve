import { createTheme } from '@mui/material/styles'
import type { Severity } from './types'

// Paleta de estado validada (good/warning/serious/critical) sobre superficie oscura #1a1a19.
// La severidad SIEMPRE se muestra con icono + texto, nunca solo con color.
export const SEVERITY_COLOR: Record<Severity, string> = {
  CRITICAL: '#d03b3b',
  HIGH: '#ec835a',
  MEDIUM: '#fab219',
  LOW: '#3987e5',
  NONE: '#8a8983',
}
export const SEVERITY_LABEL: Record<Severity, string> = {
  CRITICAL: 'Crítica',
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
  NONE: 'Sin CVSS',
}
// Texto legible sobre cada color de fondo
export const SEVERITY_INK: Record<Severity, string> = {
  CRITICAL: '#ffffff',
  HIGH: '#1a1a19',
  MEDIUM: '#1a1a19',
  LOW: '#ffffff',
  NONE: '#1a1a19',
}

export const SURFACE = '#1a1a19'
export const MONO = '"JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace'

export const theme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#111110', paper: SURFACE },
    primary: { main: '#3987e5' },
    error: { main: '#d03b3b' },
    warning: { main: '#fab219' },
    success: { main: '#0ca30c' },
    text: { primary: '#f0efec', secondary: '#c3c2b7' },
    divider: 'rgba(240,239,236,0.10)',
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: 'Inter, "Segoe UI", Roboto, system-ui, sans-serif',
    h1: { fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.02em' },
  },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', border: '1px solid rgba(240,239,236,0.08)' } } },
    MuiTableCell: { styleOverrides: { root: { borderColor: 'rgba(240,239,236,0.08)' } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
  },
})
