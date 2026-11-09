export const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'] as const
export type Severity = (typeof SEVERITIES)[number]

/** IDs de fuentes de listado/enriquecimiento/match (EPSS es score, no tag de fila). */
export const SOURCES = [
  'nvd',
  'kev',
  'github',
  'cveorg',
  'osv',
  'euvd',
  'vulncheck-kev',
  'wordfence',
] as const
export type SourceId = (typeof SOURCES)[number]

export interface KevInfo {
  dateAdded: string
  dueDate?: string
  requiredAction?: string
  ransomware: boolean
  vendor?: string
  product?: string
  name?: string
  /** Catálogo de procedencia del flag de explotación. */
  catalog?: 'cisa' | 'vulncheck'
}

export interface EpssInfo {
  score: number // 0..1 probabilidad de explotación en 30 días
  percentile: number
}

/** Registro normalizado: cada fuente se mapea a esta forma y luego se fusiona por id. */
export interface CveRecord {
  id: string // CVE-YYYY-NNNN, o GHSA-xxxx si GitHub no tiene CVE asignado
  aliases: string[]
  title?: string
  description: string
  severity: Severity
  cvss?: number
  cvssVersion?: string
  published?: string // ISO
  modified?: string
  sources: SourceId[]
  status?: string // vulnStatus de NVD
  kev?: KevInfo
  epss?: EpssInfo
  packages: string[] // ecosistema:paquete (GitHub/OSV) o vendor:producto (KEV)
  cwes: string[]
  references: string[]
  /** Ids de tecnologías del JSON que coinciden con este CVE. */
  technologies: string[]
  /** Librerías del inventario de app que relacionamos a este CVE (OSV o texto). */
  matchedLibraries: string[]
}

export type PartialCve = Partial<CveRecord> & Pick<CveRecord, 'id'> & { sources: SourceId[] }

export function isSourceId(value: string): value is SourceId {
  return (SOURCES as readonly string[]).includes(value)
}
