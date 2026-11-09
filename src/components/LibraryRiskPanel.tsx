import {
  Box, LinearProgress, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TableSortLabel, Tooltip, Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'
import type { LibraryRiskRow } from '../lib/matchLibraries'
import { useFilters } from '../store/filters'
import { MONO } from '../theme'
import type { Severity } from '../types'
import { SeverityChip } from './SeverityChip'

type LibrarySortKey = 'severity' | 'name' | 'version' | 'cves'
type SortDir = 'asc' | 'desc'

function severityRank(severity: Severity | null): number {
  if (severity === 'CRITICAL') return 5
  if (severity === 'HIGH') return 4
  if (severity === 'MEDIUM') return 3
  if (severity === 'LOW') return 2
  if (severity === 'NONE') return 1
  return 0
}

function versionParts(version?: string): number[] {
  if (!version) return []
  return version
    .split(/[.+_-]/)
    .map((part) => {
      const match = part.match(/\d+/)
      return match ? Number(match[0]) : -1
    })
}

function compareVersions(a?: string, b?: string): number {
  if (!a && !b) return 0
  if (!a) return -1
  if (!b) return 1
  const left = versionParts(a)
  const right = versionParts(b)
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0)
    if (diff !== 0) return diff
  }
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

function compareLibraries(a: LibraryRiskRow, b: LibraryRiskRow, key: LibrarySortKey): number {
  if (key === 'severity') {
    const bySeverity = severityRank(a.maxSeverity) - severityRank(b.maxSeverity)
    if (bySeverity !== 0) return bySeverity
    const byCves = a.cveIds.length - b.cveIds.length
    if (byCves !== 0) return byCves
    return a.library.displayName.localeCompare(b.library.displayName)
  }
  if (key === 'cves') {
    const byCves = a.cveIds.length - b.cveIds.length
    if (byCves !== 0) return byCves
    const bySeverity = severityRank(a.maxSeverity) - severityRank(b.maxSeverity)
    if (bySeverity !== 0) return bySeverity
    return a.library.displayName.localeCompare(b.library.displayName)
  }
  if (key === 'version') {
    const byVersion = compareVersions(a.library.version, b.library.version)
    if (byVersion !== 0) return byVersion
    return a.library.displayName.localeCompare(b.library.displayName)
  }
  return a.library.displayName.localeCompare(b.library.displayName)
}

export function LibraryRiskPanel({
  rows,
  loading,
  embedded = false,
  onLibrarySelect,
}: {
  rows: LibraryRiskRow[]
  loading: boolean
  embedded?: boolean
  onLibrarySelect?: (libraryName: string | null) => void
}) {
  const selectedLibrary = useFilters((state) => state.selectedLibrary)
  const setSelectedLibrary = useFilters((state) => state.setSelectedLibrary)
  const [sortKey, setSortKey] = useState<LibrarySortKey>('severity')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sorted = useMemo(() => {
    const copy = [...rows].sort((a, b) => compareLibraries(a, b, sortKey))
    return sortDir === 'desc' ? copy.reverse() : copy
  }, [rows, sortKey, sortDir])

  if (rows.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Esta app no tiene librerías en el inventario.
        </Typography>
      </Box>
    )
  }

  const selectLibrary = (name: string) => {
    const next = selectedLibrary === name ? null : name
    setSelectedLibrary(next)
    onLibrarySelect?.(next)
  }

  const head = (
    key: LibrarySortKey,
    label: string,
    align: 'left' | 'right' = 'left',
    hint?: string,
  ) => (
    <TableCell align={align} sortDirection={sortKey === key ? sortDir : false}>
      <Tooltip title={hint ?? ''} disableHoverListener={!hint} arrow>
        <TableSortLabel
          active={sortKey === key}
          direction={sortKey === key ? sortDir : 'desc'}
          onClick={() => {
            setSortDir(sortKey === key && sortDir === 'desc' ? 'asc' : 'desc')
            setSortKey(key)
          }}
        >
          {label}
        </TableSortLabel>
      </Tooltip>
    </TableCell>
  )

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      {loading && <LinearProgress sx={{ height: 2 }} />}
      <TableContainer sx={{ flex: 1, minHeight: 0, overflow: 'auto', maxHeight: embedded ? 'none' : 220 }}>
        <Table size="small" stickyHeader aria-label="Riesgo por librería">
          <TableHead>
            <TableRow>
              {head('name', 'Librería', 'left', 'Orden alfabético por nombre de librería')}
              {head('severity', 'Severidad', 'left', 'Severidad máxima de los CVE asociados')}
              {head('version', 'Versión', 'left', 'Orden por versión del inventario')}
              {head('cves', 'CVEs', 'right', 'Cantidad de CVE asociados a la librería')}
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((row) => {
              const name = row.library.displayName
              const active = selectedLibrary === name
              const clickable = row.cveIds.length > 0 || row.status === 'vulnerable'
              return (
                <TableRow
                  key={row.library.raw}
                  hover={clickable}
                  selected={active}
                  onClick={() => {
                    if (!clickable) return
                    selectLibrary(name)
                  }}
                  onKeyDown={(event) => {
                    if (!clickable) return
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      selectLibrary(name)
                    }
                  }}
                  tabIndex={clickable ? 0 : undefined}
                  role={clickable ? 'button' : undefined}
                  aria-pressed={active}
                  aria-label={clickable ? `Ver CVEs de ${name}` : undefined}
                  sx={{
                    cursor: clickable ? 'pointer' : 'default',
                    opacity: !selectedLibrary || active || clickable ? 1 : 0.5,
                    '&.Mui-selected': { bgcolor: 'action.selected' },
                    '&.Mui-selected:hover': { bgcolor: 'action.selected' },
                  }}
                >
                  <TableCell>
                    <Tooltip title={row.library.raw} arrow>
                      <Typography
                        sx={{ fontFamily: MONO, fontSize: 12, fontWeight: active ? 700 : 500 }}
                        noWrap
                      >
                        {name}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    {row.maxSeverity
                      ? <SeverityChip severity={row.maxSeverity} size="small" />
                      : <Typography variant="body2" color="text.secondary">—</Typography>}
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontFamily: MONO, fontSize: 12 }} color="text.secondary">
                      {row.library.version ?? '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      sx={{
                        fontFamily: MONO,
                        fontSize: 12,
                        fontWeight: row.cveIds.length > 0 ? 700 : 400,
                        color: row.cveIds.length > 0 ? 'error.main' : 'text.secondary',
                      }}
                    >
                      {row.cveIds.length}
                    </Typography>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
