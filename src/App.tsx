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
import { KpiRow } from './components/KpiRow'
import { SeverityTimeline } from './components/SeverityTimeline'
import { SourceStatus } from './components/SourceStatus'
import { TechRelationsGraph } from './components/TechRelationsGraph'
import { useCves, useFilteredCves } from './hooks/useCves'
import { useSourcesConfig } from './hooks/useSourcesConfig'
import { useFilters } from './store/filters'
import type { CveRecord } from './types'

const SIDEBAR_WIDTH = 248
const SIDEBAR_STORAGE_KEY = 'noc-cve-sidebar-open'

function readSidebarOpen(): boolean {
  try {
    const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY)
    if (saved === null) return false
    return saved === 'true'
  } catch {
    return false
  }
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

export default function App() {
  const { config } = useSourcesConfig()
  const { records, health, isFetching, refetchAll } = useCves()
  const rows = useFilteredCves(records)
  const days = useFilters((s) => s.days)
  const [selected, setSelected] = useState<CveRecord | null>(null)
  const [fs, setFs] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarOpen)
  const now = useClock()

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
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 10, bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', px: 2, py: 1.25 }}>
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
          <Typography variant="h1">NOC · CVE Watch</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>
            Multi-tecnología
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 13 }}>
            {now.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'medium' })}
          </Typography>
          <Button size="small" startIcon={<RefreshIcon />} onClick={refetchAll} disabled={isFetching}>
            Actualizar
          </Button>
          <Tooltip title={fs ? 'Salir de pantalla completa' : 'Modo pared'}>
            <IconButton onClick={toggleFs} aria-label="Pantalla completa" size="small">
              {fs ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </Tooltip>
        </Stack>
        <LinearProgress sx={{ visibility: isFetching ? 'visible' : 'hidden', height: 2 }} />
      </Box>

      <Box
        sx={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: sidebarOpen ? `${SIDEBAR_WIDTH}px minmax(0, 1fr)` : 'minmax(0, 1fr)',
          },
          minHeight: 0,
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
            position: { md: 'sticky' },
            top: { md: 56 },
            alignSelf: 'start',
            maxHeight: { md: 'calc(100vh - 56px)' },
            overflow: 'auto',
          }}
        >
          <SourceStatus health={health} onClose={() => setSidebarOpen(false)} />
        </Paper>

        <Stack spacing={2} sx={{ px: 2, py: 2, minWidth: 0 }}>
          <KpiRow rows={rows} />

          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', lg: '1.15fr 1fr' },
              alignItems: 'stretch',
            }}
          >
            <SeverityTimeline rows={rows} days={days} />
            <TechRelationsGraph rows={rows} technologies={config.technologies} />
          </Box>

          <FiltersBar />
          <CveTable rows={rows} onSelect={setSelected} />
        </Stack>
      </Box>

      <CveDrawer cve={selected} onClose={() => setSelected(null)} />
    </Box>
  )
}
