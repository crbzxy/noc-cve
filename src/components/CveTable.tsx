import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import {
  Box, Chip, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TablePagination, TableRow, TableSortLabel, Tooltip, Typography,
} from '@mui/material'
import { formatDistanceToNowStrict } from 'date-fns'
import { es } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { MONO } from '../theme'
import type { CveRecord } from '../types'
import { SeverityChip } from './SeverityChip'

type SortKey = 'risk' | 'cvss' | 'epss' | 'published'
const SEV_ORDER = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 }

const sorters: Record<Exclude<SortKey, 'risk'>, (a: CveRecord, b: CveRecord) => number> = {
  cvss: (a, b) => (a.cvss ?? -1) - (b.cvss ?? -1) || SEV_ORDER[a.severity] - SEV_ORDER[b.severity],
  epss: (a, b) => (a.epss?.score ?? -1) - (b.epss?.score ?? -1),
  published: (a, b) => (a.published ?? '').localeCompare(b.published ?? ''),
}

const SOURCE_SHORT = { nvd: 'NVD', kev: 'KEV', github: 'GH' } as const

export function CveTable({ rows, onSelect }: { rows: CveRecord[]; onSelect: (c: CveRecord) => void }) {
  const [sort, setSort] = useState<SortKey>('risk')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)
  const [perPage, setPerPage] = useState(25)

  const sorted = useMemo(() => {
    if (sort === 'risk') return dir === 'desc' ? rows : [...rows].reverse() // rows ya vienen por riesgo
    const s = [...rows].sort(sorters[sort])
    return dir === 'desc' ? s.reverse() : s
  }, [rows, sort, dir])

  const visible = sorted.slice(page * perPage, page * perPage + perPage)
  const head = (key: SortKey, label: string, align: 'left' | 'right' = 'left') => (
    <TableCell align={align} sortDirection={sort === key ? dir : false}>
      <TableSortLabel
        active={sort === key}
        direction={sort === key ? dir : 'desc'}
        onClick={() => {
          setDir(sort === key && dir === 'desc' ? 'asc' : 'desc')
          setSort(key)
          setPage(0)
        }}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  )

  return (
    <Paper>
      <TableContainer sx={{ maxHeight: 'calc(100vh - 220px)' }}>
        <Table stickyHeader size="small" aria-label="Lista de CVEs">
          <TableHead>
            <TableRow>
              {head('risk', 'ID / Prioridad')}
              <TableCell>Severidad</TableCell>
              {head('cvss', 'CVSS', 'right')}
              {head('epss', 'EPSS', 'right')}
              <TableCell>Descripción</TableCell>
              <TableCell>Fuentes</TableCell>
              {head('published', 'Publicado')}
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((c) => (
              <TableRow key={c.id} hover onClick={() => onSelect(c)} sx={{ cursor: 'pointer' }}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                    {c.kev && (
                      <Tooltip title={`En CISA KEV desde ${c.kev.dateAdded}${c.kev.ransomware ? ' · usado en ransomware' : ''}`}>
                        <LocalFireDepartmentIcon fontSize="small" sx={{ color: c.kev.ransomware ? '#d03b3b' : '#ec835a' }} aria-label="Explotada activamente" />
                      </Tooltip>
                    )}
                    <Typography sx={{ fontFamily: MONO, fontSize: 13, fontWeight: 600 }}>{c.id}</Typography>
                  </Stack>
                </TableCell>
                <TableCell><SeverityChip severity={c.severity} /></TableCell>
                <TableCell align="right" sx={{ fontFamily: MONO }}>
                  {c.cvss?.toFixed(1) ?? '—'}
                  {c.cvssVersion && <Typography component="span" variant="caption" color="text.secondary"> v{c.cvssVersion.split('.')[0]}</Typography>}
                </TableCell>
                <TableCell align="right" sx={{ fontFamily: MONO }}>
                  {c.epss ? (
                    <Tooltip title={`Percentil ${(c.epss.percentile * 100).toFixed(0)}`}>
                      <span>{(c.epss.score * 100).toFixed(c.epss.score < 0.01 ? 2 : 1)} %</span>
                    </Tooltip>
                  ) : '—'}
                </TableCell>
                <TableCell sx={{ maxWidth: 560 }}>
                  {c.title && <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{c.title}</Typography>}
                  <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: c.title ? 1 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {c.description || 'Sin descripción'}
                  </Typography>
                  {c.packages.length > 0 && (
                    <Typography variant="caption" sx={{ fontFamily: MONO, color: 'primary.light' }} noWrap component="div">
                      {c.packages.slice(0, 3).join('  ')}{c.packages.length > 3 ? `  +${c.packages.length - 3}` : ''}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    {c.sources.map((s) => <Chip key={s} size="small" variant="outlined" label={SOURCE_SHORT[s]} />)}
                  </Stack>
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Tooltip title={c.published ?? ''}>
                    <span>{c.published ? formatDistanceToNowStrict(new Date(c.published), { locale: es, addSuffix: true }) : '—'}</span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>Sin CVEs con los filtros actuales.</Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={sorted.length}
        page={Math.min(page, Math.max(0, Math.ceil(sorted.length / perPage) - 1))}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={perPage}
        onRowsPerPageChange={(e) => { setPerPage(Number(e.target.value)); setPage(0) }}
        rowsPerPageOptions={[25, 50, 100]}
        labelRowsPerPage="Filas"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
      />
    </Paper>
  )
}
