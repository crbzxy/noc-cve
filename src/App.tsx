import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import MenuIcon from '@mui/icons-material/Menu'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import RefreshIcon from '@mui/icons-material/Refresh'
import ShieldIcon from '@mui/icons-material/Shield'
import { Box, Button, IconButton, LinearProgress, Paper, Stack, Tooltip, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import { CveDrawer } from './components/CveDrawer'
import { CveTable } from './components/CveTable'
import { FiltersBar } from './components/FiltersBar'
import { HeaderClock } from './components/HeaderClock'
import { KpiRow } from './components/KpiRow'
import { SeverityTimeline } from './components/SeverityTimeline'
import { SourceStatus } from './components/SourceStatus'
import { TechnologySelect } from './components/TechnologySelect'
import { TopVulnerableTechsChart } from './components/TopVulnerableTechsChart'
import { useCves, useFilteredCves } from './hooks/useCves'
import { useSourcesConfig } from './hooks/useSourcesConfig'
import { applyStackOnlyFromConfig, useFilters } from './store/filters'
import type { CveRecord } from './types'

const SIDEBAR_WIDTH = 248
const SIDEBAR_STORAGE_KEY = 'noc-cve-sidebar-open'
const HEADER_HEIGHT = 52

function readSidebarOpen(): boolean {
  try {
    const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY)
    if (saved === null) return false
    return saved === 'true'
  } catch {
    return false
  }
}

export default function App() {
  const { config } = useSourcesConfig()
  const { records, health, isFetching, refetchAll } = useCves()
  const rows = useFilteredCves(records)
  const days = useFilters((s) => s.days)
  const [selected, setSelected] = useState<CveRecord | null>(null)
  const [fs, setFs] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarOpen)

  useEffect(() => {
    applyStackOnlyFromConfig(config.defaults.stackOnly)
  }, [config.defaults.stackOnly])

  useEffect(() => {
    const onChange = () => setFs(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarOpen))
    } catch {
      // ignore
    }
  }, [sidebarOpen])

  const toggleFs = () =>
    document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()

  const hasSourceError = health.some((h) => h.status === 'error')

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
          <ShieldIcon color="primary" />
          <Typography
            component="h1"
            sx={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}
          >
            Truper · NOC CVE Watch
          </Typography>
          <TechnologySelect minWidth={280} />
          <Box sx={{ flex: 1 }} />
          <HeaderClock />
          <Button size="small" startIcon={<RefreshIcon />} onClick={refetchAll} disabled={isFetching}>
            Actualizar
          </Button>
          <Tooltip title={fs ? 'Salir de pantalla completa' : 'Modo pared'}>
            <IconButton onClick={toggleFs} aria-label="Pantalla completa" size="small">
              {fs ? <FullscreenExitIcon /> : <FullscreenIcon />}
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
            display: 'grid',
            gridTemplateRows: 'auto auto auto minmax(0, 1fr)',
            gap: 1.5,
            px: 2,
            py: 1.5,
            overflow: 'hidden',
          }}
        >
          <KpiRow rows={rows} />

          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: { xs: '1fr', lg: '1.15fr 1fr' },
              alignItems: 'stretch',
              minHeight: 0,
              height: { xs: 'auto', lg: 220 },
            }}
          >
            <SeverityTimeline rows={rows} days={days} />
            <TopVulnerableTechsChart rows={rows} technologies={config.technologies} />
          </Box>

          <FiltersBar />

          <Box sx={{ minHeight: 0, height: '100%', overflow: 'hidden' }}>
            <CveTable rows={rows} onSelect={setSelected} />
          </Box>
        </Box>
      </Box>

      <CveDrawer cve={selected} onClose={() => setSelected(null)} />
    </Box>
  )
}
