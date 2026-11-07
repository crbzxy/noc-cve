export const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'] as const
export type Severity = (typeof SEVERITIES)[number]

export const SOURCES = ['nvd', 'kev', 'github'] as const
export type SourceId = (typeof SOURCES)[number]

export interface KevInfo {
  dateAdded: string
  dueDate?: string
  requiredAction?: string
  ransomware: boolean
  vendor?: string
  product?: string
  name?: string
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
  packages: string[] // ecosistema:paquete (GitHub) o vendor:producto (KEV)
  cwes: string[]
  references: string[]
}

export type PartialCve = Partial<CveRecord> & Pick<CveRecord, 'id'> & { sources: SourceId[] }
