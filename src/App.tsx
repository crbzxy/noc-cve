import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import LogoutIcon from '@mui/icons-material/Logout'
import RefreshIcon from '@mui/icons-material/Refresh'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import { Box, Chip, IconButton, LinearProgress, MenuItem, Paper, Select, Skeleton, Stack, Tooltip, Typography } from '@mui/material'
import { useColorScheme } from '@mui/material/styles'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useState, useTransition } from 'react'
import { AppSelect } from './components/AppSelect'
import { CveSection } from './components/CveSection'
import { ExpandableModule } from './components/ExpandableModule'
import { ExportExcelButton } from './components/ExportExcelButton'
import { FiltersBar } from './components/FiltersBar'
import { HeaderClock } from './components/HeaderClock'
import { KpiRow } from './components/KpiRow'
import { LibraryRiskPanel } from './components/LibraryRiskPanel'
import { SearchBox } from './components/SearchBox'
import { SourceConnectionLogs } from './components/SourceConnectionLogs'
import { SourceHealthPill, SourceStatus } from './components/SourceStatus'

const SeverityTimeline = lazy(async () => {
  const module = await import('./components/SeverityTimeline')
  return { default: module.SeverityTimeline }
})
const TopVulnerableTechsChart = lazy(async () => {
  const module = await import('./components/TopVulnerableTechsChart')
  return { default: module.TopVulnerableTechsChart }
})
import { useAppsConfig } from './hooks/useAppsConfig'
import { useCveViews, useCves } from './hooks/useCves'
import { buildLibraryRiskRows } from './lib/matchLibraries'
import { useSourcesConfig } from './hooks/useSourcesConfig'
import { useFilters } from './store/filters'
import { HEADER_BG, SEVERITY_COLOR, SEVERITY_INK } from './theme'
import type { Severity } from './types'

const LIBRARY_SEVERITY_ORDER: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE']
/** Conteos de librerías (no de CVEs): evita confundir con el KPI. */
const LIBRARY_SEVERITY_COUNT_LABEL: Record<Severity, { one: string; many: string }> = {
  CRITICAL: { one: 'librería con riesgo crítico', many: 'librerías con riesgo crítico' },
  HIGH: { one: 'librería con riesgo alto', many: 'librerías con riesgo alto' },
  MEDIUM: { one: 'librería con riesgo medio', many: 'librerías con riesgo medio' },
  LOW: { one: 'librería con riesgo bajo', many: 'librerías con riesgo bajo' },
  NONE: { one: 'librería sin riesgo', many: 'librerías sin riesgo' },
}

const SIDEBAR_WIDTH = 248
const SIDEBAR_STORAGE_KEY = 'noc-cve-sidebar-open'
const CHARTS_STORAGE_KEY = 'noc-cve-charts-open'
const TABLE_STORAGE_KEY = 'noc-cve-table-open'
const LIBS_STORAGE_KEY = 'noc-cve-libs-open'
const HEADER_HEIGHT = 64

function readBooleanStorage(key: string, fallback: boolean): boolean {
  try {
    const saved = localStorage.getItem(key)
    if (saved === null) return fallback
    return saved === 'true'
  } catch {
    return fallback
  }
}

function persistBoolean(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // ignore
  }
}

export default function App() {
  const { config } = useSourcesConfig()
  const { options: appOptions } = useAppsConfig()
  const {
    records, packageHits, appLibraries, libraryRiskLoading, health, isFetching, refetchAll,
    corpusGeneratedAt, initialLoading,
  } = useCves()
  // Diferir el recálculo pesado mantiene la UI responsiva al cambiar de app.
  const deferredRecords = useDeferredValue(records)
  const deferredLibraries = useDeferredValue(appLibraries)
  const deferredPackageHits = useDeferredValue(packageHits)
  const { rows, libraryScopedRows, fallbackHint } = useCveViews(deferredRecords)
  const libraryRisk = useMemo(
    () => buildLibraryRiskRows(deferredLibraries, libraryScopedRows, deferredPackageHits),
    [deferredLibraries, libraryScopedRows, deferredPackageHits],
  )
  const days = useFilters((s) => s.days)
  const selectedAppId = useFilters((s) => s.selectedAppId)
  const selectedLibrary = useFilters((s) => s.selectedLibrary)
  const setSelectedLibrary = useFilters((s) => s.setSelectedLibrary)
  const { mode, systemMode, setMode: setColorMode } = useColorScheme()
  // mode es undefined en el primer render; 'system' se resuelve al modo real del SO.
  const colorMode = (mode === 'system' ? systemMode : mode) ?? 'dark'
  const refreshMin = useFilters((s) => s.refreshMin)
  const setRefreshMin = useFilters((s) => s.setRefreshMin)
  const selectedAppLabel = appOptions.find((option) => option.id === selectedAppId)?.label
  const [fs, setFs] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(() => readBooleanStorage(SIDEBAR_STORAGE_KEY, false))
  const [chartsOpen, setChartsOpen] = useState(() => readBooleanStorage(CHARTS_STORAGE_KEY, false))
  const [tableOpen, setTableOpen] = useState(() => readBooleanStorage(TABLE_STORAGE_KEY, true))
  const [libsOpen, setLibsOpen] = useState(() => readBooleanStorage(LIBS_STORAGE_KEY, true))
  const [connectionLogsOpen, setConnectionLogsOpen] = useState(false)
  const [isFilterPending, startFilterTransition] = useTransition()
  const viewsPending = deferredRecords !== records || isFilterPending || libraryRiskLoading

  useEffect(() => {
    const onChange = () => setFs(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => { persistBoolean(SIDEBAR_STORAGE_KEY, sidebarOpen) }, [sidebarOpen])
  useEffect(() => { persistBoolean(CHARTS_STORAGE_KEY, chartsOpen) }, [chartsOpen])
  useEffect(() => { persistBoolean(TABLE_STORAGE_KEY, tableOpen) }, [tableOpen])
  useEffect(() => { persistBoolean(LIBS_STORAGE_KEY, libsOpen) }, [libsOpen])

  const toggleFs = () =>
    document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()

  const kevUnavailable = health.some((h) => h.id === 'kev' && h.status === 'error')
  const kevFilterAvailable = health.some(
    (row) => (row.id === 'kev' || row.id === 'vulncheck-kev')
      && (row.status === 'ok' || row.status === 'loading'),
  )
  const kevOnly = useFilters((state) => state.kevOnly)
  const setKevOnly = useFilters((state) => state.setKevOnly)

  useEffect(() => {
    if (!kevFilterAvailable && kevOnly) setKevOnly(false)
  }, [kevFilterAvailable, kevOnly, setKevOnly])
  const librarySeverityCounts = useMemo(() => {
    const counts: Partial<Record<Severity, number>> = {}
    for (const row of libraryRisk) {
      if (row.status !== 'vulnerable' || !row.maxSeverity) continue
      counts[row.maxSeverity] = (counts[row.maxSeverity] ?? 0) + 1
    }
    return counts
  }, [libraryRisk])

  return (
    <Box
      sx={{
        height: '100vh',
        overflow: 'hidden',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          height: HEADER_HEIGHT,
          zIndex: 10,
          bgcolor: HEADER_BG,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', px: 3, height: '100%' }}>
          <Tooltip title="Doble clic: ver logs de por qué no conectan las fuentes">
            <IconButton
              size="small"
              color="primary"
              aria-label="Logs de conexión de fuentes"
              onDoubleClick={() => {
                setConnectionLogsOpen(true)
                setSidebarOpen(true)
              }}
              sx={{ p: 0.5 }}
            >
              <ShieldOutlinedIcon sx={{ fontSize: 22 }} />
            </IconButton>
          </Tooltip>
          <Typography
            component="h1"
            sx={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', whiteSpace: 'nowrap', pr: 1 }}
          >
            Truper · NOC CVE
          </Typography>
          <SearchBox />
          <AppSelect width={240} />
          <Box sx={{ flex: 1 }} />
          <SourceHealthPill
            health={health}
            open={sidebarOpen}
            onToggle={() => setSidebarOpen((open) => !open)}
          />
          {corpusGeneratedAt != null && (
            <Tooltip title={`Corpus ingerido ${new Date(corpusGeneratedAt).toLocaleString('es-MX')}`}>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 170 }}>
                Actualizado {formatDistanceToNow(corpusGeneratedAt, { locale: es, addSuffix: true })}
              </Typography>
            </Tooltip>
          )}
          <Select
            variant="standard"
            disableUnderline
            value={refreshMin}
            onChange={(event) => setRefreshMin(Number(event.target.value))}
            inputProps={{ 'aria-label': 'Frecuencia de actualización' }}
            sx={{ fontSize: 12, color: 'text.secondary', '& .MuiSelect-select': { py: 0 } }}
          >
            {[0, 5, 15, 30, 60].map((v) => (
              <MenuItem key={v} value={v}>{v === 0 ? 'manual' : `cada ${v} min`}</MenuItem>
            ))}
          </Select>
          <HeaderClock />
          <ExportExcelButton
            cves={rows}
            libraryRisk={libraryRisk}
            apps={appOptions}
            selectedAppLabel={selectedAppLabel}
            days={days}
            corpusGeneratedAt={corpusGeneratedAt}
            disabled={isFetching || viewsPending}
          />
          <Tooltip title="Forzar re-ingesta del corpus">
            <span>
              <IconButton size="small" onClick={refetchAll} disabled={isFetching} aria-label="Actualizar">
                <RefreshIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={colorMode === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
            <IconButton
              size="small"
              onClick={() => setColorMode(colorMode === 'dark' ? 'light' : 'dark')}
              aria-label={colorMode === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {colorMode === 'dark' ? <LightModeOutlinedIcon fontSize="small" /> : <DarkModeOutlinedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title={fs ? 'Salir de pantalla completa' : 'Modo pared'}>
            <IconButton onClick={toggleFs} aria-label="Pantalla completa" size="small">
              {fs ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Cerrar sesión">
            <IconButton
              size="small"
              aria-label="Cerrar sesión"
              component="a"
              href="/api/auth/logout"
            >
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
        <LinearProgress
          sx={{
            visibility: isFetching ? 'visible' : 'hidden',
            height: 2,
            position: 'absolute',
            left: 0,
            right: 0,
            mt: '-2px',
          }}
        />
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: sidebarOpen ? `${SIDEBAR_WIDTH}px minmax(0, 1fr)` : 'minmax(0, 1fr)',
          },
        }}
      >
        <Paper
          component="aside"
          square
          sx={{
            display: sidebarOpen ? 'block' : 'none',
            borderTop: 0,
            borderBottom: 0,
            borderLeft: 0,
            height: '100%',
            overflow: 'auto',
          }}
        >
          <SourceStatus health={health} onClose={() => setSidebarOpen(false)} />
        </Paper>

        <Box
          sx={{
            minWidth: 0,
            minHeight: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            px: 3,
            py: 2.5,
            overflow: 'hidden',
            opacity: viewsPending ? 0.88 : 1,
            transition: 'opacity 160ms ease',
          }}
        >
          <Box sx={{ flexShrink: 0 }}>
            <KpiRow rows={rows} kevUnavailable={kevUnavailable} loading={initialLoading} />
          </Box>

          <Box sx={{ flexShrink: 0 }}>
            <FiltersBar
              kevUnavailable={kevUnavailable}
              kevFilterAvailable={kevFilterAvailable}
              windowFallbackHint={fallbackHint}
            />
          </Box>

          {!selectedAppId && (
            <ExpandableModule
              id="noc-charts-panel"
              title="Gráficas"
              open={chartsOpen}
              onToggle={() => setChartsOpen((open) => !open)}
              defaultHeight={389}
              fixedHeight={389}
            >
              <Box
                sx={{
                  height: '100%',
                  minHeight: 389,
                  display: 'grid',
                  gap: 1,
                  p: 1,
                  boxSizing: 'border-box',
                  gridTemplateColumns: { xs: '1fr', lg: '1.15fr 1fr' },
                }}
              >
                {initialLoading ? (
                  <>
                    <Skeleton variant="rounded" sx={{ height: '100%', minHeight: 360 }} />
                    <Skeleton variant="rounded" sx={{ height: '100%', minHeight: 360 }} />
                  </>
                ) : (
                  <Suspense fallback={<Skeleton variant="rounded" sx={{ height: '100%', gridColumn: '1 / -1' }} />}>
                    <SeverityTimeline rows={rows} days={days} />
                    <TopVulnerableTechsChart rows={rows} technologies={config.technologies} />
                  </Suspense>
                )}
              </Box>
            </ExpandableModule>
          )}

          {selectedAppId && (
            <ExpandableModule
              id="noc-libs-panel"
              title="Librerías"
              count={libraryRisk.length}
              open={libsOpen}
              onToggle={() => setLibsOpen((open) => !open)}
              defaultHeight={220}
              trailing={(
                <>
                  {selectedAppLabel && (
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 220 }}>
                      {selectedAppLabel}
                    </Typography>
                  )}
                  {LIBRARY_SEVERITY_ORDER.map((severity) => {
                    const count = librarySeverityCounts[severity] ?? 0
                    if (count === 0) return null
                    const label = count === 1
                      ? LIBRARY_SEVERITY_COUNT_LABEL[severity].one
                      : LIBRARY_SEVERITY_COUNT_LABEL[severity].many
                    return (
                      <Tooltip
                        key={severity}
                        title={`Librerías con severidad máxima ${severity} (no es el total de CVEs del KPI)`}
                      >
                        <Chip
                          size="small"
                          label={`${count} ${label}`}
                          onClick={(event) => event.stopPropagation()}
                          sx={{
                            bgcolor: SEVERITY_COLOR[severity],
                            color: SEVERITY_INK[severity],
                            fontWeight: 700,
                          }}
                        />
                      </Tooltip>
                    )
                  })}
                  {selectedLibrary && (
                    <Chip
                      size="small"
                      color="warning"
                      variant="outlined"
                      label={selectedLibrary}
                      onDelete={(event) => {
                        event.stopPropagation()
                        setSelectedLibrary(null)
                      }}
                      onClick={(event) => event.stopPropagation()}
                    />
                  )}
                </>
              )}
            >
              <LibraryRiskPanel
                rows={libraryRisk}
                loading={viewsPending}
                embedded
                onLibrarySelect={(libraryName) => {
                  startFilterTransition(() => {
                    setSelectedLibrary(libraryName)
                    if (libraryName) {
                      setTableOpen(true)
                      setLibsOpen(true)
                    }
                  })
                }}
              />
            </ExpandableModule>
          )}

          <CveSection
            rows={rows}
            loading={initialLoading}
            open={tableOpen}
            onToggle={() => setTableOpen((open) => !open)}
            selectedLibrary={selectedLibrary}
            onClearLibrary={() => setSelectedLibrary(null)}
          />
        </Box>
      </Box>

      <SourceConnectionLogs
        open={connectionLogsOpen}
        health={health}
        onClose={() => setConnectionLogsOpen(false)}
      />
    </Box>
  )
}
