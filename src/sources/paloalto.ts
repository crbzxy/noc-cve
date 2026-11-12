import { daysAgo, getJson, normalizeSeverity } from '../lib/http'
import type { PartialCve } from '../types'

// Palo Alto Networks Security Advisories JSON
// https://security.paloaltonetworks.com/json

interface PaloAltoAdvisory {
  ID?: string
  title?: string
  problem?: string
  solution?: string
  baseSeverity?: string
  severity?: string
  threatSeverity?: string
  baseScore?: number
  date?: string
  updated?: string
  product?: string[]
  version?: string[]
  affected?: string[]
}

function inWindow(advisory: PaloAltoAdvisory, sinceMs: number): boolean {
  const stamp = Date.parse(advisory.updated || advisory.date || '')
  if (!Number.isFinite(stamp)) return true
  return stamp >= sinceMs
}

function mapAdvisory(advisory: PaloAltoAdvisory): PartialCve | null {
  const id = advisory.ID
  if (!id?.startsWith('CVE-')) return null
  const products = [...new Set([...(advisory.product ?? []), ...(advisory.version ?? [])])]
    .map((name) => `paloalto:${name}`)
  const description = [advisory.problem, advisory.solution]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return {
    id,
    title: advisory.title,
    description,
    severity: normalizeSeverity(advisory.baseSeverity || advisory.severity || advisory.threatSeverity),
    cvss: advisory.baseScore,
    cvssVersion: advisory.baseScore != null ? '3.1' : undefined,
    published: advisory.date,
    modified: advisory.updated,
    packages: products,
    cwes: [],
    references: [`https://security.paloaltonetworks.com/${id}`],
    sources: ['paloalto'],
  }
}

export async function fetchPaloAlto(days: number, signal?: AbortSignal): Promise<PartialCve[]> {
  const sinceMs = daysAgo(days).getTime()
  const { data } = await getJson<PaloAltoAdvisory[]>('/api/paloalto', signal)
  return (Array.isArray(data) ? data : [])
    .filter((row) => inWindow(row, sinceMs))
    .map(mapAdvisory)
    .filter((row): row is PartialCve => Boolean(row))
}
