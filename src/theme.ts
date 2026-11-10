import { createTheme } from '@mui/material/styles'
import type { Severity } from './types'

// Paleta de estado validada (good/warning/serious/critical); se usa igual en modo claro y oscuro.
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
  HIGH: '#0b0d10',
  MEDIUM: '#0b0d10',
  LOW: '#ffffff',
  NONE: '#0b0d10',
}

/**
 * Señal KEV (explotada conocida): distinta de severidad.
 * Alta = #ec835a; KEV = naranja vivo para no confundirlas en el top.
 */
export const KEV_COLOR = '#ff6b00'
export const MONO = '"JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace'

export type ColorMode = 'dark' | 'light'

/**
 * Tokens por modo. Los componentes usan las constantes `var(--noc-…)` de abajo,
 * así el cambio de modo es solo CSS (sin re-render ni recalcular estilos).
 */
const TOKENS = {
  dark: {
    pageBg: '#0b0d10',
    headerBg: '#0e1115',
    surface: '#12151a',
    surfaceSunken: '#0f1216',
    border: '#1e232b',
    borderStrong: '#262c36',
    textPrimary: '#e6e8eb',
    textSecondary: '#9aa3af',
    textStrong: '#ffffff',
    primary: '#4c8dff',
    primaryHover: '#6ea3ff',
    primaryActive: '#3a74d9',
    accentSoft: 'rgba(76,141,255,0.14)',
    accentSelected: 'rgba(76,141,255,0.2)',
    segmentSelected: '#253042',
    rowSelected: '#18202c',
    tagBg: '#1a1f27',
    packageText: '#8fb4ff',
    chartGrid: 'rgba(230,232,235,0.07)',
    chartCursor: 'rgba(230,232,235,0.06)',
    sourceOff: '#3a414c',
    sevCritical: '#ff8a8a',
    sevHigh: '#f7a882',
    sevMedium: '#fbbf5a',
    sevLow: '#8fb4ff',
    sevNone: '#9aa3af',
  },
  light: {
    pageBg: '#f4f6f9',
    headerBg: '#ffffff',
    surface: '#ffffff',
    surfaceSunken: '#f8fafc',
    border: '#e3e7ed',
    borderStrong: '#d3d9e1',
    textPrimary: '#111827',
    textSecondary: '#5b6472',
    textStrong: '#0b1220',
    primary: '#2f6fe4',
    primaryHover: '#4a83ea',
    primaryActive: '#245bc2',
    accentSoft: 'rgba(47,111,228,0.10)',
    accentSelected: 'rgba(47,111,228,0.16)',
    segmentSelected: '#e1ebff',
    rowSelected: '#e8f0fe',
    tagBg: '#eef1f5',
    packageText: '#2557c7',
    chartGrid: 'rgba(17,24,39,0.08)',
    chartCursor: 'rgba(17,24,39,0.05)',
    sourceOff: '#c9cfd8',
    // Más oscuros que en dark para mantener contraste ≥ 4.5:1 sobre blanco.
    sevCritical: '#b42323',
    sevHigh: '#b4501f',
    sevMedium: '#8a5a00',
    sevLow: '#1f5fbf',
    sevNone: '#5b6472',
  },
} as const satisfies Record<ColorMode, Record<string, string>>

type TokenName = keyof typeof TOKENS.dark

const cssVar = (name: TokenName) => `var(--noc-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)})`

function tokenDeclarations(mode: ColorMode): Record<string, string> {
  return Object.fromEntries(
    Object.entries(TOKENS[mode]).map(([name, value]) => [cssVar(name as TokenName).slice(4, -1), value]),
  )
}

export const PAGE_BG = cssVar('pageBg')
export const HEADER_BG = cssVar('headerBg')
export const SURFACE = cssVar('surface')
/** Superficie secundaria (filtros, tabla) un tono bajo SURFACE. */
export const SURFACE_SUNKEN = cssVar('surfaceSunken')
export const BORDER = cssVar('border')
export const BORDER_STRONG = cssVar('borderStrong')
export const TEXT_PRIMARY = cssVar('textPrimary')
export const TEXT_SECONDARY = cssVar('textSecondary')
/** Texto de máximo contraste (valor seleccionado, segmento activo). */
export const TEXT_STRONG = cssVar('textStrong')
export const PRIMARY = cssVar('primary')
export const ACCENT_SOFT = cssVar('accentSoft')
export const ACCENT_SELECTED = cssVar('accentSelected')
export const SEGMENT_SELECTED = cssVar('segmentSelected')
export const ROW_SELECTED = cssVar('rowSelected')
export const TAG_BG = cssVar('tagBg')
export const PACKAGE_TEXT = cssVar('packageText')
export const SOURCE_OFF = cssVar('sourceOff')
export const CHART_TICK = TEXT_SECONDARY
export const CHART_GRID = cssVar('chartGrid')
export const CHART_CURSOR = cssVar('chartCursor')
/** Etiqueta de severidad como texto sobre la superficie del modo actual. */
export const SEVERITY_TEXT: Record<Severity, string> = {
  CRITICAL: cssVar('sevCritical'),
  HIGH: cssVar('sevHigh'),
  MEDIUM: cssVar('sevMedium'),
  LOW: cssVar('sevLow'),
  NONE: cssVar('sevNone'),
}

/** Atributo en <html> que MUI actualiza al cambiar de modo. */
const SCHEME_ATTRIBUTE = 'data-noc-theme'

function palette(mode: ColorMode) {
  const t = TOKENS[mode]
  return {
    background: { default: t.pageBg, paper: t.surface },
    primary: { main: t.primary },
    error: { main: '#d03b3b' },
    warning: { main: mode === 'dark' ? '#fab219' : '#b7791f' },
    success: { main: '#0ca30c' },
    text: { primary: t.textPrimary, secondary: t.textSecondary },
    divider: t.border,
  }
}

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: SCHEME_ATTRIBUTE },
  defaultColorScheme: 'dark',
  colorSchemes: {
    dark: { palette: palette('dark') },
    light: { palette: palette('light') },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: 'Inter, "Segoe UI", Roboto, system-ui, sans-serif',
    h1: { fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.02em' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Antes del primer render MUI aún no pone el atributo: :root cae en dark (modo por defecto).
        ':root': tokenDeclarations('dark'),
        [`[${SCHEME_ATTRIBUTE}="dark"]`]: tokenDeclarations('dark'),
        [`[${SCHEME_ATTRIBUTE}="light"]`]: tokenDeclarations('light'),
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
          backgroundColor: cssVar('primaryHover'),
        },
        '*::-webkit-scrollbar-thumb:active': {
          backgroundColor: cssVar('primaryActive'),
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
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', border: `1px solid ${BORDER}` }, rounded: { borderRadius: 12 } } },
    MuiTableCell: { styleOverrides: { root: { borderColor: BORDER } } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 9, backgroundColor: SURFACE }, notchedOutline: { borderColor: BORDER_STRONG } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
  },
})
