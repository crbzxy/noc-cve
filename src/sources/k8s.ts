import { daysAgo, getJson, normalizeSeverity } from '../lib/http'
import type { PartialCve } from '../types'

// Kubernetes official CVE JSON Feed 1.1
// https://kubernetes.io/docs/reference/issues-security/official-cve-feed/index.json

interface K8sFeedItem {
  id?: string
  summary?: string
  content_text?: string
  date_published?: string
  url?: string
  external_url?: string
  status?: string
}

interface K8sFeed {
  items?: K8sFeedItem[]
}

function parseCvss(content?: string): { score?: number; severity?: string; version?: string } {
  if (!content) return {}
  const rating = content.match(/CVSS Rating:\s*\*\*([0-9.]+)\*\*\s*\((\w+)\)/i)
  const vector = content.match(/CVSS:(\d+(?:\.\d+)?)\/[A-Z0-9:/]+/i)
  return {
    score: rating ? Number(rating[1]) : undefined,
    severity: rating?.[2],
    version: vector?.[1],
  }
}

function parsePackages(content?: string, summary?: string): string[] {
  const text = `${summary ?? ''}\n${content ?? ''}`
  const packages = new Set<string>(['kubernetes:kubernetes'])
  if (/ingress-nginx/i.test(text)) packages.add('kubernetes:ingress-nginx')
  if (/kubelet/i.test(text)) packages.add('kubernetes:kubelet')
  if (/kube-apiserver/i.test(text)) packages.add('kubernetes:kube-apiserver')
  if (/kubectl/i.test(text)) packages.add('kubernetes:kubectl')
  return [...packages]
}

function mapItem(item: K8sFeedItem, sinceMs: number): PartialCve | null {
  const id = item.id
  if (!id?.startsWith('CVE-')) return null
  if (item.date_published) {
    const stamp = Date.parse(item.date_published)
    if (Number.isFinite(stamp) && stamp < sinceMs) return null
  }
  const cvss = parseCvss(item.content_text)
  const description = (item.content_text ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000)
  return {
    id,
    title: item.summary,
    description,
    severity: normalizeSeverity(cvss.severity),
    cvss: Number.isFinite(cvss.score) ? cvss.score : undefined,
    cvssVersion: cvss.version,
    published: item.date_published,
    status: item.status,
    packages: parsePackages(item.content_text, item.summary),
    cwes: [],
    references: [item.url, item.external_url].filter((url): url is string => Boolean(url)),
    sources: ['k8s'],
  }
}

export async function fetchK8s(days: number, signal?: AbortSignal): Promise<PartialCve[]> {
  const sinceMs = daysAgo(days).getTime()
  const { data } = await getJson<K8sFeed>('/api/k8s', signal)
  return (data.items ?? [])
    .map((item) => mapItem(item, sinceMs))
    .filter((row): row is PartialCve => Boolean(row))
}
