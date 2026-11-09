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
/**
 * Señal KEV (explotada conocida): distinta de severidad.
 * Alta = #ec835a; KEV = naranja vivo para no confundirlas en el top.
 */
export const KEV_COLOR = '#ff6b00'
export const TEXT_PRIMARY = '#f0efec'
export const TEXT_SECONDARY = '#c3c2b7'
export const CHART_TICK = TEXT_SECONDARY
export const CHART_GRID = 'rgba(240,239,236,0.07)'
export const CHART_CURSOR = 'rgba(240,239,236,0.06)'
export const MONO = '"JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace'

const PRIMARY = '#3987e5'
const PRIMARY_HOVER = '#5a9aeb'
const PRIMARY_ACTIVE = '#2f6fc0'
const PAGE_BG = '#111110'

export const theme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: PAGE_BG, paper: SURFACE },
    primary: { main: PRIMARY },
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
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          scrollbarWidth: 'thin',
          scrollbarColor: `${PRIMARY} ${SURFACE}`,
        },
        body: {
          scrollbarWidth: 'thin',
          scrollbarColor: `${PRIMARY} ${SURFACE}`,
        },
        '*::-webkit-scrollbar': {
          width: 10,
          height: 10,
        },
        '*::-webkit-scrollbar-track': {
          backgroundColor: SURFACE,
          borderRadius: 8,
        },
        '*::-webkit-scrollbar-thumb': {
          backgroundColor: PRIMARY,
          borderRadius: 8,
          border: `2px solid ${SURFACE}`,
        },
        '*::-webkit-scrollbar-thumb:hover': {
          backgroundColor: PRIMARY_HOVER,
        },
        '*::-webkit-scrollbar-thumb:active': {
          backgroundColor: PRIMARY_ACTIVE,
        },
        // Quita los triángulos/flechas del scrollbar
        '*::-webkit-scrollbar-button': {
          display: 'none',
          width: 0,
          height: 0,
        },
        '*::-webkit-scrollbar-corner': {
          backgroundColor: 'transparent',
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', border: '1px solid rgba(240,239,236,0.08)' } } },
    MuiTableCell: { styleOverrides: { root: { borderColor: 'rgba(240,239,236,0.08)' } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
  },
})
