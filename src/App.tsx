import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import MenuIcon from '@mui/icons-material/Menu'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import RefreshIcon from '@mui/icons-material/Refresh'
import ShieldIcon from '@mui/icons-material/Shield'
import { Box, Chip, IconButton, LinearProgress, Paper, Stack, Tooltip, Typography } from '@mui/material'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useState, useTransition } from 'react'
import { AppSelect } from './components/AppSelect'
import { CveDrawer } from './components/CveDrawer'
import { CveTable } from './components/CveTable'
import { ExpandableModule } from './components/ExpandableModule'
import { ExportExcelButton } from './components/ExportExcelButton'
import { FiltersBar } from './components/FiltersBar'
import { HeaderClock } from './components/HeaderClock'
import { KpiRow } from './components/KpiRow'
import { LibraryRiskPanel } from './components/LibraryRiskPanel'
import { SourceStatus } from './components/SourceStatus'
import { TechnologySelect } from './components/TechnologySelect'

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
import { SEVERITY_COLOR, SEVERITY_INK } from './theme'
import type { CveRecord, Severity } from './types'

const LIBRARY_SEVERITY_ORDER: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE']
/** Conteos de librerías (no de CVEs): evita confundir con el KPI. */
const LIBRARY_SEVERITY_COUNT_LABEL: Record<Severity, { one: string; many: string }> = {
  CRITICAL: { one: 'lib crítica', many: 'libs críticas' },
  HIGH: { one: 'lib alta', many: 'libs altas' },
  MEDIUM: { one: 'lib media', many: 'libs medias' },
  LOW: { one: 'lib baja', many: 'libs bajas' },
  NONE: { one: 'lib sin CVSS', many: 'libs sin CVSS' },
}

const SIDEBAR_WIDTH = 248
const SIDEBAR_STORAGE_KEY = 'noc-cve-sidebar-open'
const CHARTS_STORAGE_KEY = 'noc-cve-charts-open'
const TABLE_STORAGE_KEY = 'noc-cve-table-open'
const LIBS_STORAGE_KEY = 'noc-cve-libs-open'
const HEADER_HEIGHT = 52

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
    corpusGeneratedAt, newCriticalIds,
  } = useCves()
  // Diferir el recálculo pesado mantiene la UI responsiva al cambiar de app.
  const deferredRecords = useDeferredValue(records)
  const deferredLibraries = useDeferredValue(appLibraries)
  const deferredPackageHits = useDeferredValue(packageHits)
  const { rows, libraryScopedRows } = useCveViews(deferredRecords)
  const libraryRisk = useMemo(
    () => buildLibraryRiskRows(deferredLibraries, libraryScopedRows, deferredPackageHits),
    [deferredLibraries, libraryScopedRows, deferredPackageHits],
  )
  const days = useFilters((s) => s.days)
  const selectedAppId = useFilters((s) => s.selectedAppId)
  const selectedLibrary = useFilters((s) => s.selectedLibrary)
  const setSelectedLibrary = useFilters((s) => s.setSelectedLibrary)
  const selectedAppLabel = appOptions.find((option) => option.id === selectedAppId)?.label
  const [selected, setSelected] = useState<CveRecord | null>(null)
  const [fs, setFs] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(() => readBooleanStorage(SIDEBAR_STORAGE_KEY, false))
  const [chartsOpen, setChartsOpen] = useState(() => readBooleanStorage(CHARTS_STORAGE_KEY, false))
  const [tableOpen, setTableOpen] = useState(() => readBooleanStorage(TABLE_STORAGE_KEY, true))
  const [libsOpen, setLibsOpen] = useState(() => readBooleanStorage(LIBS_STORAGE_KEY, true))
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

  const hasSourceError = health.some((h) => h.status === 'error')
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
          bgcolor: 'background.default',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', px: 2, height: '100%' }}>
          <Tooltip title={sidebarOpen ? 'Cerrar fuentes' : 'Abrir fuentes'}>
            <IconButton
              onClick={() => setSidebarOpen((open) => !open)}
              aria-label={sidebarOpen ? 'Cerrar panel de fuentes' : 'Abrir panel de fuentes'}
              aria-expanded={sidebarOpen}
              size="small"
              color={hasSourceError && !sidebarOpen ? 'error' : 'default'}
            >
              {sidebarOpen ? <MenuOpenIcon /> : <MenuIcon />}
            </IconButton>
          </Tooltip>
          <ShieldIcon color="primary" fontSize="small" />
          <Typography
            component="h1"
            sx={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}
          >
            Truper · NOC CVE
          </Typography>
          <TechnologySelect minWidth={220} />
          <AppSelect minWidth={240} />
          <Box sx={{ flex: 1 }} />
          {newCriticalIds.length > 0 && (
            <Tooltip title={newCriticalIds.slice(0, 12).join(', ') + (newCriticalIds.length > 12 ? '…' : '')}>
              <Chip
                size="small"
                color="error"
                label={`+${newCriticalIds.length} CRITICAL`}
                sx={{ fontWeight: 700 }}
              />
            </Tooltip>
          )}
          {corpusGeneratedAt != null && (
            <Tooltip title={`Corpus ingerido ${new Date(corpusGeneratedAt).toLocaleString('es-MX')}`}>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 160 }}>
                Datos {formatDistanceToNow(corpusGeneratedAt, { locale: es, addSuffix: true })}
              </Typography>
            </Tooltip>
          )}
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
          <Tooltip title={fs ? 'Salir de pantalla completa' : 'Modo pared'}>
            <IconButton onClick={toggleFs} aria-label="Pantalla completa" size="small">
              {fs ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
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
            gap: 1,
            px: 2,
            py: 1.5,
            overflow: 'hidden',
            opacity: viewsPending ? 0.88 : 1,
            transition: 'opacity 160ms ease',
          }}
        >
          <Box sx={{ flexShrink: 0 }}>
            <KpiRow rows={rows} />
          </Box>

          <Box sx={{ flexShrink: 0 }}>
            <FiltersBar />
          </Box>

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
              <Suspense fallback={<Box sx={{ height: '100%' }} />}>
                <SeverityTimeline rows={rows} days={days} />
                <TopVulnerableTechsChart rows={rows} technologies={config.technologies} />
              </Suspense>
            </Box>
          </ExpandableModule>

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
                    if (libraryName) {
                      setTableOpen(true)
                      setLibsOpen(true)
                    }
                  })
                }}
              />
            </ExpandableModule>
          )}

          <ExpandableModule
            id="noc-cve-table-panel"
            title="CVEs"
            count={rows.length}
            open={tableOpen}
            onToggle={() => setTableOpen((open) => !open)}
            defaultHeight={320}
            trailing={selectedLibrary ? (
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
            ) : undefined}
          >
            <CveTable rows={rows} onSelect={setSelected} embedded />
          </ExpandableModule>
        </Box>
      </Box>

      <CveDrawer cve={selected} onClose={() => setSelected(null)} />
    </Box>
  )
}
