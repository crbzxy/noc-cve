import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import RefreshIcon from '@mui/icons-material/Refresh'
import ShieldIcon from '@mui/icons-material/Shield'
import { Box, Button, IconButton, LinearProgress, Stack, Tooltip, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import { CveDrawer } from './components/CveDrawer'
import { CveTable } from './components/CveTable'
import { FiltersBar } from './components/FiltersBar'
import { KpiRow } from './components/KpiRow'
import { SeverityTimeline } from './components/SeverityTimeline'
import { SourceStatus } from './components/SourceStatus'
import { useCves, useFilteredCves } from './hooks/useCves'
import { useFilters } from './store/filters'
import type { CveRecord } from './types'

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

export default function App() {
  const { records, health, isFetching, refetchAll } = useCves()
  const rows = useFilteredCves(records)
  const days = useFilters((s) => s.days)
  const [selected, setSelected] = useState<CveRecord | null>(null)
  const [fs, setFs] = useState(false)
  const now = useClock()

  useEffect(() => {
    const onChange = () => setFs(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFs = () =>
    document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 10, bgcolor: 'background.default' }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", px: 3, py: 1.5 }}>
          <ShieldIcon color="primary" />
          <Typography variant="h1">NOC · CVE Watch</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            NVD · CISA KEV · GitHub Advisories · EPSS
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
            {now.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'medium' })}
          </Typography>
          <Button size="small" startIcon={<RefreshIcon />} onClick={refetchAll} disabled={isFetching}>
            Actualizar
          </Button>
          <Tooltip title={fs ? 'Salir de pantalla completa' : 'Modo pared (pantalla completa)'}>
            <IconButton onClick={toggleFs} aria-label="Pantalla completa">
              {fs ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </Tooltip>
        </Stack>
        <LinearProgress sx={{ visibility: isFetching ? 'visible' : 'hidden', height: 2 }} />
      </Box>

      <Stack spacing={2} sx={{ px: 3, py: 2 }}>
        <KpiRow rows={rows} />
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' } }}>
          <SeverityTimeline rows={rows} days={days} />
          <SourceStatus health={health} />
        </Box>
        <FiltersBar />
        <CveTable rows={rows} onSelect={setSelected} />
      </Stack>

      <CveDrawer cve={selected} onClose={() => setSelected(null)} />
    </Box>
  )
}
