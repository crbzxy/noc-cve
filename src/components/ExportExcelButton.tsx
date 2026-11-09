import FileDownloadIcon from '@mui/icons-material/FileDownload'
import { CircularProgress, IconButton, Tooltip } from '@mui/material'
import { useState } from 'react'
import type { AppOption } from '../config/apps.schema'
import { exportDashboardExcel } from '../lib/exportExcel'
import type { LibraryRiskRow } from '../lib/matchLibraries'
import type { CveRecord } from '../types'

export function ExportExcelButton({
  cves,
  libraryRisk,
  apps,
  selectedAppLabel,
  days,
  corpusGeneratedAt,
  disabled = false,
}: {
  cves: CveRecord[]
  libraryRisk: LibraryRiskRow[]
  apps: AppOption[]
  selectedAppLabel?: string
  days: number
  corpusGeneratedAt?: number | null
  disabled?: boolean
}) {
  const [exporting, setExporting] = useState(false)

  const onExport = () => {
    if (exporting) return
    setExporting(true)
    exportDashboardExcel({
      cves,
      libraryRisk,
      apps,
      selectedAppLabel,
      days,
      corpusGeneratedAt,
    })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        console.error('No se pudo exportar Excel:', message)
        window.alert('No se pudo generar el Excel. Revisa la consola o intenta de nuevo.')
      })
      .finally(() => setExporting(false))
  }

  return (
    <Tooltip title="Exportar vista actual a Excel (CVEs, librerías e inventario)">
      <span>
        <IconButton
          size="small"
          onClick={onExport}
          disabled={disabled || exporting}
          aria-label="Exportar a Excel"
        >
          {exporting
            ? <CircularProgress size={16} color="inherit" />
            : <FileDownloadIcon fontSize="small" />}
        </IconButton>
      </span>
    </Tooltip>
  )
}
