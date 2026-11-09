import type { AppOption } from '../config/apps.schema'
import type { LibraryRiskRow } from './matchLibraries'
import { fetchLatestVersions, isVersionBehind } from '../sources/latestVersions'
import type { CveRecord } from '../types'

export interface ExportExcelInput {
  cves: CveRecord[]
  libraryRisk: LibraryRiskRow[]
  apps: AppOption[]
  selectedAppLabel?: string
  days: number
  corpusGeneratedAt?: number | null
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function cell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '<Cell><Data ss:Type="String"></Data></Cell>'
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`
  }
  if (typeof value === 'boolean') {
    return `<Cell><Data ss:Type="String">${value ? 'Sí' : 'No'}</Data></Cell>`
  }
  return `<Cell><Data ss:Type="String">${escapeXml(String(value))}</Data></Cell>`
}

function row(values: Array<string | number | boolean | null | undefined>): string {
  return `<Row>${values.map(cell).join('')}</Row>`
}

function sheet(name: string, rows: string[]): string {
  const safeName = escapeXml(name.slice(0, 31))
  return `<Worksheet ss:Name="${safeName}"><Table>${rows.join('')}</Table></Worksheet>`
}

function joinList(values: string[]): string {
  return values.join('; ')
}

function buildResumenSheet(input: ExportExcelInput): string {
  const vulnerable = input.libraryRisk.filter((item) => item.status === 'vulnerable').length
  const rows = [
    row(['Campo', 'Valor']),
    row(['Generado', new Date().toLocaleString('es-MX')]),
    row(['Corpus', input.corpusGeneratedAt ? new Date(input.corpusGeneratedAt).toLocaleString('es-MX') : '—']),
    row(['Ventana (días)', input.days]),
    row(['Aplicación', input.selectedAppLabel ?? 'Todas']),
    row(['CVEs exportados', input.cves.length]),
    row(['Libs en inventario', input.libraryRisk.length]),
    row(['Libs vulnerables', vulnerable]),
    row(['Apps en inventario', input.apps.length]),
  ]
  return sheet('Resumen', rows)
}

function buildCvesSheet(cves: CveRecord[]): string {
  const header = row([
    'CVE', 'Severidad', 'CVSS', 'EPSS', 'KEV', 'Publicado', 'Modificado',
    'Tecnologías', 'Librerías', 'Fuentes', 'Paquetes', 'CWEs', 'Título', 'Descripción', 'Referencias',
  ])
  const body = cves.map((cve) => row([
    cve.id,
    cve.severity,
    cve.cvss ?? '',
    cve.epss?.score ?? '',
    Boolean(cve.kev),
    cve.published ?? '',
    cve.modified ?? '',
    joinList(cve.technologies),
    joinList(cve.matchedLibraries),
    joinList(cve.sources),
    joinList(cve.packages),
    joinList(cve.cwes),
    cve.title ?? '',
    cve.description,
    joinList(cve.references),
  ]))
  return sheet('CVEs', [header, ...body])
}

async function buildLibrariesSheet(libraryRisk: LibraryRiskRow[]): Promise<string> {
  const header = row([
    'Librería', 'Ecosistema', 'Versión app', 'Última / LTS', 'Canal', 'Desactualizada',
    'Estado', 'Severidad máx', 'CVEs', 'GroupId', 'PackageKey',
  ])
  if (libraryRisk.length === 0) {
    return sheet('Librerías', [header, row(['Sin app seleccionada o sin librerías'])])
  }

  const latestByKey = await fetchLatestVersions(libraryRisk.map((item) => item.library))
  const body = libraryRisk.map((item) => {
    const latest = latestByKey[item.library.packageKey]
    const latestLabel = latest?.latest ?? ''
    const channel = latest?.channel === 'lts' ? 'LTS' : latest?.channel === 'latest' ? 'latest' : ''
    return row([
      item.library.displayName,
      item.library.ecosystem,
      item.library.version ?? '',
      latestLabel,
      channel,
      isVersionBehind(item.library.version, latest?.latest ?? null),
      item.status,
      item.maxSeverity ?? '',
      joinList(item.cveIds),
      item.library.groupId ?? '',
      item.library.packageKey,
    ])
  })
  return sheet('Librerías', [header, ...body])
}

function buildInventarioSheet(apps: AppOption[]): string {
  const header = row([
    'Aplicación', 'Tecnología', 'Framework', 'Bases de datos', 'Librerías (conteo)', 'Librerías',
  ])
  const body = apps.map((app) => row([
    app.label,
    app.entry.tecnologia,
    app.entry.framework,
    joinList(app.entry['base de datos']),
    app.entry.librerias.length,
    joinList(app.entry.librerias),
  ]))
  return sheet('Inventario apps', [header, ...body])
}

function workbookXml(sheets: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
${sheets.join('\n')}
</Workbook>`
}

function downloadBlob(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function exportFilename(appLabel?: string): string {
  const stamp = new Date().toISOString().slice(0, 10)
  const slug = (appLabel ?? 'todas')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `noc-cve-${slug}-${stamp}.xls`
}

/** Exporta la vista actual + inventario a un Excel multi-hoja (SpreadsheetML). */
export async function exportDashboardExcel(input: ExportExcelInput): Promise<void> {
  const sheets = [
    buildResumenSheet(input),
    buildCvesSheet(input.cves),
    await buildLibrariesSheet(input.libraryRisk),
    buildInventarioSheet(input.apps),
  ]
  downloadBlob(exportFilename(input.selectedAppLabel), workbookXml(sheets))
}
