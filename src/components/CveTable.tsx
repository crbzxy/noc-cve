import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import {
  Box, Chip, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TablePagination, TableRow, TableSortLabel, Tooltip, Typography,
} from '@mui/material'
import { formatDistanceToNowStrict } from 'date-fns'
import { es } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { useSourcesConfig } from '../hooks/useSourcesConfig'
import { riskScore } from '../lib/aggregate'
import { KEV_COLOR, MONO, SEVERITY_COLOR } from '../theme'
import type { CveRecord, SourceId } from '../types'
import { SeverityChip } from './SeverityChip'

type SortKey = 'risk' | 'severity' | 'cvss' | 'epss' | 'published'
const SEV_ORDER = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 }

const SOURCE_SHORT: Record<SourceId, string> = { nvd: 'NVD', kev: 'KEV', github: 'GH' }

const sorters: Record<Exclude<SortKey, 'risk'>, (a: CveRecord, b: CveRecord) => number> = {
  severity: (a, b) =>
    SEV_ORDER[a.severity] - SEV_ORDER[b.severity]
    || (a.cvss ?? -1) - (b.cvss ?? -1),
  cvss: (a, b) => (a.cvss ?? -1) - (b.cvss ?? -1) || SEV_ORDER[a.severity] - SEV_ORDER[b.severity],
  epss: (a, b) => (a.epss?.score ?? -1) - (b.epss?.score ?? -1),
  published: (a, b) => (a.published ?? '').localeCompare(b.published ?? ''),
}

export function CveTable({ rows, onSelect }: { rows: CveRecord[]; onSelect: (c: CveRecord) => void }) {
  const { config } = useSourcesConfig()
  const [sort, setSort] = useState<SortKey>(config.defaults.sortBy)
  const [dir, setDir] = useState<'asc' | 'desc'>(config.defaults.sortDir)
  const [page, setPage] = useState(0)
  const [perPage, setPerPage] = useState(25)

  const techLabel = useMemo(
    () => Object.fromEntries(config.technologies.map((tech) => [tech.id, tech.label])),
    [config.technologies],
  )

  const sorted = useMemo(() => {
    const copy = [...rows]
    if (sort === 'risk') {
      copy.sort((a, b) => riskScore(a) - riskScore(b))
    } else {
      copy.sort(sorters[sort])
    }
    return dir === 'desc' ? copy.reverse() : copy
  }, [rows, sort, dir])

  const visible = sorted.slice(page * perPage, page * perPage + perPage)
  const head = (
    key: SortKey,
    label: string,
    align: 'left' | 'right' = 'left',
    hint?: string,
  ) => (
    <TableCell align={align} sortDirection={sort === key ? dir : false}>
      <Tooltip title={hint ?? ''} disableHoverListener={!hint} arrow>
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
      </Tooltip>
    </TableCell>
  )

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <TableContainer sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Table stickyHeader size="small" aria-label="Lista de CVEs">
          <TableHead>
            <TableRow>
              {head('risk', 'ID / Prioridad', 'left', 'Orden por prioridad NOC: explotada, EPSS, stack y severidad')}
              {head('severity', 'Severidad', 'left', 'Nivel de severidad según CVSS (Critical, High, Medium, Low)')}
              {head('cvss', 'CVSS', 'right', 'Common Vulnerability Scoring System — impacto técnico de 0 a 10 (fuente NVD)')}
              {head('epss', 'EPSS', 'right', 'Exploit Prediction Scoring System — probabilidad de explotación en los próximos 30 días (FIRST)')}
              <TableCell>Descripción</TableCell>
              <TableCell>Fuentes</TableCell>
              {head('published', 'Publicado', 'left', 'Fecha de publicación del CVE')}
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((c) => (
              <TableRow
                key={c.id}
                hover
                tabIndex={0}
                role="button"
                aria-label={`Abrir detalle de ${c.id}`}
                onClick={() => onSelect(c)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(c)
                  }
                }}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                    {c.kev && (
                      <Tooltip title={`En CISA KEV desde ${c.kev.dateAdded}${c.kev.ransomware ? ' · usado en ransomware' : ''}`}>
                        <LocalFireDepartmentIcon fontSize="small" sx={{ color: c.kev.ransomware ? SEVERITY_COLOR.CRITICAL : KEV_COLOR }} aria-label="Explotada activamente" />
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
                  {(c.packages.length > 0 || c.technologies.length > 0) && (
                    <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap' }} useFlexGap>
                      {c.technologies.slice(0, 4).map((techId) => (
                        <Chip key={techId} size="small" color="secondary" variant="outlined" label={techLabel[techId] ?? techId} />
                      ))}
                      {c.packages.length > 0 && (
                        <Typography variant="caption" sx={{ fontFamily: MONO, color: 'primary.light' }} noWrap>
                          {c.packages.slice(0, 2).join('  ')}{c.packages.length > 2 ? `  +${c.packages.length - 2}` : ''}
                        </Typography>
                      )}
                    </Stack>
                  )}
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    {c.sources.map((s) => <Chip key={s} size="small" variant="outlined" label={SOURCE_SHORT[s] ?? s} />)}
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
                  <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                    Sin CVEs con los filtros actuales. Amplía tecnologías o relaja severidad, fuentes o EPSS.
                  </Box>
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
        sx={{ flexShrink: 0, borderTop: 1, borderColor: 'divider' }}
      />
    </Paper>
  )
}
