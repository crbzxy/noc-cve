import type { CveRecord } from '../types'
import { daysAgo } from './http'

/** Ventana máxima de ingesta: la UI filtra días sobre este corpus. */
export const CORPUS_WINDOW_DAYS = 90

/** Refresh automático del corpus (5 min). */
export const CORPUS_REFRESH_MS = 5 * 60_000

export function windowCutoffIso(days: number): string {
  return daysAgo(days).toISOString()
}

/** Incluye el CVE si published o modified caen dentro de la ventana. */
export function isInTimeWindow(
  record: Pick<CveRecord, 'published' | 'modified'>,
  days: number,
): boolean {
  const cutoff = windowCutoffIso(days)
  const published = record.published
  const modified = record.modified
  if (published && published >= cutoff) return true
  if (modified && modified >= cutoff) return true
  return false
}

export function filterByWindow<T extends Pick<CveRecord, 'published' | 'modified'>>(
  records: T[],
  days: number,
): T[] {
  if (days >= CORPUS_WINDOW_DAYS) return records
  return records.filter((record) => isInTimeWindow(record, days))
}

/**
 * Vista app/inventario: respeta la ventana temporal, pero no oculta
 * CRITICAL/HIGH ligados a libs (si la versión no cambió, el riesgo sigue abierto).
 */
export function filterInventoryByWindow<
  T extends Pick<CveRecord, 'published' | 'modified' | 'severity' | 'matchedLibraries'>,
>(records: T[], days: number): T[] {
  if (days >= CORPUS_WINDOW_DAYS) return records
  return records.filter((record) => {
    if (isInTimeWindow(record, days)) return true
    if (record.matchedLibraries.length === 0) return false
    return record.severity === 'CRITICAL' || record.severity === 'HIGH'
  })
}
