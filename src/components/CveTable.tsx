import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import {
  Box, Chip, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  Skeleton, TablePagination, TableRow, TableSortLabel, Tooltip, Typography,
} from '@mui/material'
import { formatDistanceToNowStrict } from 'date-fns'
import { es } from 'date-fns/locale'
import { memo, useMemo, useState } from 'react'
import { useSourcesConfig } from '../hooks/useSourcesConfig'
import { riskScore } from '../lib/aggregate'
import { useFilters } from '../store/filters'
import {
  BORDER, BORDER_STRONG, KEV_COLOR, MONO, PACKAGE_TEXT, PRIMARY, ROW_SELECTED, SEVERITY_COLOR, SEVERITY_LABEL,
  SEVERITY_TEXT, TAG_BG,
} from '../theme'
import type { CveRecord, SourceId } from '../types'

type SortKey = 'risk' | 'severity' | 'cvss' | 'epss' | 'published'
const SKELETON_ROWS = 10
const SEV_ORDER = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 }

const SOURCE_SHORT: Record<SourceId, string> = {
  nvd: 'NVD',
  kev: 'KEV',
  github: 'GH',
  cveorg: 'CVE',
  circl: 'CIRCL',
  redhat: 'RH',
  osv: 'OSV',
  euvd: 'EUVD',
  'vulncheck-kev': 'VCKEV',
  wordfence: 'WF',
}

const sorters: Record<Exclude<SortKey, 'risk'>, (a: CveRecord, b: CveRecord) => number> = {
  severity: (a, b) =>
    SEV_ORDER[a.severity] - SEV_ORDER[b.severity]
    || (a.cvss ?? -1) - (b.cvss ?? -1),
  cvss: (a, b) => (a.cvss ?? -1) - (b.cvss ?? -1) || SEV_ORDER[a.severity] - SEV_ORDER[b.severity],
  epss: (a, b) => (a.epss?.score ?? -1) - (b.epss?.score ?? -1),
  published: (a, b) => (a.published ?? '').localeCompare(b.published ?? ''),
}

const ROW_SX = {
  cursor: 'pointer',
  '&.Mui-selected, &.Mui-selected:hover': { bgcolor: ROW_SELECTED },
  '& > td': { py: 1.25 },
} as const

const ID_STACK_SX = { alignItems: 'center' } as const
const CVE_ID_SX = { fontFamily: MONO, fontSize: 12.5, fontWeight: 500 } as const
const TITLE_SX = { fontWeight: 600, fontSize: 13.5 } as const
const META_STACK_SX = { mt: 0.625, flexWrap: 'wrap', alignItems: 'center' } as const
const TECH_TAG_SX = {
  fontSize: 11,
  px: 0.875,
  py: 0.25,
  borderRadius: '5px',
  bgcolor: TAG_BG,
  color: 'text.secondary',
} as const
const PACKAGE_SX = { fontFamily: MONO, fontSize: 11, color: PACKAGE_TEXT } as const
const SOURCE_TAG_SX = {
  fontSize: 10.5,
  fontWeight: 600,
  px: 0.625,
  borderRadius: '4px',
  border: `1px solid ${BORDER_STRONG}`,
  color: 'text.secondary',
} as const
const CVSS_SX = { fontFamily: MONO, fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap' } as const
const CVSS_VERSION_SX = { fontSize: 10, fontWeight: 400 } as const
const EPSS_CELL_SX = { width: 120 } as const
const EPSS_VALUE_SX = { fontFamily: MONO, fontSize: 12 } as const
const EPSS_TRACK_SX = { mt: 0.5, height: 4, borderRadius: '2px', bgcolor: BORDER, overflow: 'hidden' } as const
const PUBLISHED_SX = { whiteSpace: 'nowrap', fontSize: 12, color: 'text.secondary' } as const
const SKELETON_ROW_SX = { '& > td': { py: 1.25 } } as const
const EMPTY_CELL_SX = { py: 6, textAlign: 'center', color: 'text.secondary' } as const
const TABLE_CONTAINER_SX = { flex: 1, minHeight: 0, overflow: 'auto' } as const
const PAGINATION_SX = { flexShrink: 0, borderTop: 1, borderColor: 'divider' } as const
const ROOT_SX = { height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' } as const

const CveRow = memo(function CveRow({
  cve,
  selected,
  techLabel,
  onSelect,
}: {
  cve: CveRecord
  selected: boolean
  techLabel: Record<string, string>
  onSelect: (cve: CveRecord) => void
}) {
  const idCellSx = useMemo(
    () => ({
      whiteSpace: 'nowrap' as const,
      boxShadow: `inset 4px 0 0 ${SEVERITY_COLOR[cve.severity]}`,
      pl: 2,
    }),
    [cve.severity],
  )
  const severityLabelSx = useMemo(
    () => ({
      fontSize: 11,
      fontWeight: 600,
      color: SEVERITY_TEXT[cve.severity],
      mt: 0.25,
    }),
    [cve.severity],
  )
  const epssBarSx = useMemo(
    () => (cve.epss
      ? { height: '100%', width: `${Math.max(2, cve.epss.percentile * 100)}%`, bgcolor: PRIMARY }
      : undefined),
    [cve.epss],
  )

  return (
    <TableRow
      hover
      tabIndex={0}
      role="button"
      aria-label={`Abrir detalle de ${cve.id}`}
      onClick={() => onSelect(cve)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(cve)
        }
      }}
      selected={selected}
      sx={ROW_SX}
    >
      <TableCell sx={idCellSx}>
        <Stack direction="row" spacing={0.75} sx={ID_STACK_SX}>
          {cve.kev && (
            <Tooltip title={`En CISA KEV desde ${cve.kev.dateAdded}${cve.kev.ransomware ? ' · usado en ransomware' : ''}`}>
              <LocalFireDepartmentIcon
                fontSize="small"
                sx={{ color: cve.kev.ransomware ? SEVERITY_COLOR.CRITICAL : KEV_COLOR }}
                aria-label="Explotada activamente"
              />
            </Tooltip>
          )}
          <Typography sx={CVE_ID_SX}>{cve.id}</Typography>
        </Stack>
        <Typography component="div" sx={severityLabelSx}>
          {SEVERITY_LABEL[cve.severity]}
        </Typography>
      </TableCell>
      <TableCell sx={{ maxWidth: 560 }}>
        <Typography variant="body2" noWrap sx={TITLE_SX} title={cve.title || cve.description}>
          {cve.title || cve.description || 'Sin descripción'}
        </Typography>
        {(cve.packages.length > 0 || cve.technologies.length > 0 || cve.matchedLibraries.length > 0 || cve.sources.length > 0) && (
          <Stack direction="row" spacing={0.625} sx={META_STACK_SX} useFlexGap>
            {cve.matchedLibraries.slice(0, 3).map((library) => (
              <Chip key={library} size="small" color="warning" variant="outlined" label={library} />
            ))}
            {cve.matchedLibraries.length > 3 && (
              <Chip size="small" color="warning" variant="outlined" label={`+${cve.matchedLibraries.length - 3}`} />
            )}
            {cve.technologies.slice(0, 4).map((techId) => (
              <Box key={techId} component="span" sx={TECH_TAG_SX}>
                {techLabel[techId] ?? techId}
              </Box>
            ))}
            {cve.packages.length > 0 && (
              <Typography variant="caption" sx={PACKAGE_SX} noWrap>
                {cve.packages.slice(0, 2).join('  ')}{cve.packages.length > 2 ? `  +${cve.packages.length - 2}` : ''}
              </Typography>
            )}
            {cve.sources.map((source) => (
              <Box key={source} component="span" sx={SOURCE_TAG_SX}>
                {SOURCE_SHORT[source] ?? source}
              </Box>
            ))}
          </Stack>
        )}
      </TableCell>
      <TableCell align="right" sx={CVSS_SX}>
        {cve.cvss?.toFixed(1) ?? '—'}
        {cve.cvssVersion && (
          <Typography component="span" sx={CVSS_VERSION_SX} color="text.secondary">
            {' '}
            v{cve.cvssVersion.split('.')[0]}
          </Typography>
        )}
      </TableCell>
      <TableCell sx={EPSS_CELL_SX}>
        {cve.epss && epssBarSx ? (
          <Tooltip title={`Percentil ${(cve.epss.percentile * 100).toFixed(0)} (largo de la barra)`}>
            <Box>
              <Typography sx={EPSS_VALUE_SX}>
                {(cve.epss.score * 100).toFixed(cve.epss.score < 0.01 ? 2 : 1)}
                {' '}
                %
              </Typography>
              <Box sx={EPSS_TRACK_SX}>
                <Box sx={epssBarSx} />
              </Box>
            </Box>
          </Tooltip>
        ) : (
          <Typography sx={EPSS_VALUE_SX} color="text.secondary">—</Typography>
        )}
      </TableCell>
      <TableCell align="right" sx={PUBLISHED_SX}>
        <Tooltip title={cve.published ?? ''}>
          <span>
            {cve.published
              ? formatDistanceToNowStrict(new Date(cve.published), { locale: es, addSuffix: true })
              : '—'}
          </span>
        </Tooltip>
      </TableCell>
    </TableRow>
  )
})

export const CveTable = memo(function CveTable({
  rows,
  onSelect,
  selectedId,
  loading = false,
  embedded = false,
}: {
  rows: CveRecord[]
  onSelect: (c: CveRecord) => void
  selectedId?: string
  /** Primera carga del corpus: filas skeleton en lugar del estado vacío. */
  loading?: boolean
  /** Sin borde propio cuando ya vive dentro de un Paper contenedor. */
  embedded?: boolean
}) {
  const { config } = useSourcesConfig()
  const kevOnly = useFilters((state) => state.kevOnly)
  const [sort, setSort] = useState<SortKey>(config.defaults.sortBy)
  const [dir, setDir] = useState<'asc' | 'desc'>(config.defaults.sortDir)
  const [page, setPage] = useState(0)
  const [perPage, setPerPage] = useState(25)
  const [previousRows, setPreviousRows] = useState(rows)
  if (rows !== previousRows) {
    setPreviousRows(rows)
    setPage(0)
  }

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

  const safePage = page === 0
    ? 0
    : Math.min(page, Math.max(0, Math.ceil(sorted.length / perPage) - 1))
  const visible = sorted.slice(safePage * perPage, safePage * perPage + perPage)

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

  const body = (
    <>
      <TableContainer sx={TABLE_CONTAINER_SX}>
        <Table stickyHeader size="small" aria-label="Lista de CVEs">
          <TableHead>
            <TableRow>
              {head('risk', 'CVE', 'left', 'Orden por prioridad NOC: explotada, EPSS, stack y severidad')}
              <TableCell>Vulnerabilidad</TableCell>
              {head('cvss', 'CVSS', 'right', 'Common Vulnerability Scoring System — impacto técnico de 0 a 10 (fuente NVD)')}
              {head('epss', 'EPSS', 'left', 'Exploit Prediction Scoring System — probabilidad de explotación en los próximos 30 días (FIRST)')}
              {head('published', 'Publicado', 'right', 'Fecha de publicación del CVE')}
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((cve) => (
              <CveRow
                key={cve.id}
                cve={cve}
                selected={cve.id === selectedId}
                techLabel={techLabel}
                onSelect={onSelect}
              />
            ))}
            {loading && Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <TableRow key={`skeleton-${index}`} sx={SKELETON_ROW_SX}>
                <TableCell sx={{ boxShadow: `inset 4px 0 0 ${BORDER}`, pl: 2 }}>
                  <Skeleton width={120} height={18} />
                  <Skeleton width={48} height={14} />
                </TableCell>
                <TableCell>
                  <Skeleton width={`${55 + ((index * 17) % 35)}%`} height={18} />
                  <Stack direction="row" spacing={0.625} sx={{ mt: 0.625 }}>
                    <Skeleton variant="rounded" width={56} height={16} />
                    <Skeleton variant="rounded" width={40} height={16} />
                    <Skeleton variant="rounded" width={28} height={16} />
                  </Stack>
                </TableCell>
                <TableCell align="right"><Skeleton width={40} height={20} sx={{ ml: 'auto' }} /></TableCell>
                <TableCell sx={EPSS_CELL_SX}>
                  <Skeleton width={44} height={16} />
                  <Skeleton variant="rounded" height={4} sx={{ mt: 0.5 }} />
                </TableCell>
                <TableCell align="right"><Skeleton width={72} height={16} sx={{ ml: 'auto' }} /></TableCell>
              </TableRow>
            ))}
            {!loading && visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Box sx={EMPTY_CELL_SX}>
                    {kevOnly
                      ? 'Ninguna CVE explotada (KEV) en estos filtros. Si el KPI KEV dice «Fuente no disponible», apaga «Solo explotadas» o recarga Fuentes.'
                      : 'Sin CVEs con los filtros actuales (ni en 3 meses). Relaja búsqueda, tecnologías, severidad, fuentes o EPSS.'}
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
        page={safePage}
        onPageChange={(_, nextPage) => setPage(nextPage)}
        rowsPerPage={perPage}
        onRowsPerPageChange={(event) => {
          setPerPage(Number(event.target.value))
          setPage(0)
        }}
        rowsPerPageOptions={[25, 50, 100]}
        labelRowsPerPage="Filas"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
        sx={PAGINATION_SX}
      />
    </>
  )

  if (embedded) {
    return <Box sx={ROOT_SX}>{body}</Box>
  }

  return <Paper sx={ROOT_SX}>{body}</Paper>
})
