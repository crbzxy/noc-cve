// Servidor demo: imita las fuentes configuradas con datos sintéticos.
// Útil sin internet o cuando la red corporativa bloquea alguna fuente.
//   npm run mock   (terminal 1)   →   npm run dev:mock   (terminal 2)
import { createServer } from 'node:http'

const port = Number(process.env.MOCK_PORT ?? 4010)
let seed = 42
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const pick = (xs) => xs[Math.floor(rnd() * xs.length)]
const iso = (daysBack) => new Date(Date.now() - daysBack * 86_400_000 - rnd() * 86_400_000).toISOString()
const sevOf = (s) => (s >= 9 ? 'CRITICAL' : s >= 7 ? 'HIGH' : s >= 4 ? 'MEDIUM' : 'LOW')

const vendors = [['apache', 'tomcat'], ['microsoft', 'exchange'], ['fortinet', 'fortios'], ['cisco', 'ios xe'], ['ivanti', 'connect secure'], ['adobe', 'commerce'], ['vmware', 'vcenter'], ['citrix', 'netscaler']]
const pkgs = [['npm', 'next'], ['npm', 'axios'], ['maven', 'org.springframework:spring-web'], ['pip', 'django'], ['composer', 'magento/framework'], ['go', 'golang.org/x/net'], ['rust', 'hyper'], ['npm', 'react-native']]
const kinds = ['remote code execution', 'SQL injection', 'cross-site scripting', 'path traversal', 'authentication bypass', 'deserialization of untrusted data', 'SSRF', 'denial of service']
const cwes = ['CWE-79', 'CWE-89', 'CWE-22', 'CWE-287', 'CWE-502', 'CWE-918', 'CWE-400', 'CWE-94']

const N = 420
const cves = Array.from({ length: N }, (_, i) => {
  const score = Math.round((2 + rnd() * 8) * 10) / 10
  const [vendor, product] = pick(vendors)
  const k = Math.floor(rnd() * kinds.length)
  return {
    id: `CVE-2026-${String(40000 + i).padStart(5, '0')}`,
    published: iso(rnd() * 30), score, vendor, product, kind: kinds[k], cwe: cwes[k],
    hasCvss: rnd() > 0.12,
  }
})

const nvd = (url) => {
  const start = new Date(url.searchParams.get('pubStartDate') + 'Z')
  const list = cves.filter((c) => new Date(c.published) >= start)
  const idx = Number(url.searchParams.get('startIndex') ?? 0)
  const per = Number(url.searchParams.get('resultsPerPage') ?? 2000)
  return {
    resultsPerPage: Math.min(per, list.length - idx), startIndex: idx, totalResults: list.length,
    vulnerabilities: list.slice(idx, idx + per).map((c) => ({
      cve: {
        id: c.id, published: c.published.replace('Z', ''), lastModified: c.published.replace('Z', ''),
        vulnStatus: c.hasCvss ? 'Analyzed' : 'Awaiting Analysis',
        descriptions: [{ lang: 'en', value: `A ${c.kind} vulnerability in ${c.vendor} ${c.product} allows a remote attacker to compromise the affected system via crafted requests.` }],
        metrics: c.hasCvss ? { cvssMetricV31: [{ type: 'Primary', cvssData: { version: '3.1', baseScore: c.score, baseSeverity: sevOf(c.score) } }] } : {},
        weaknesses: [{ description: [{ lang: 'en', value: c.cwe }] }],
        references: [{ url: `https://example.com/advisories/${c.id}` }],
      },
    })),
  }
}

const github = (url) => {
  const since = (url.searchParams.get('published') ?? '>=1970-01-01').slice(2)
  const all = Array.from({ length: 140 }, (_, i) => {
    const shared = i % 3 === 0 ? cves[i] : null
    const [eco, name] = pick(pkgs)
    const score = Math.round((3 + rnd() * 7) * 10) / 10
    const ghsa = `GHSA-${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}-mock`
    return {
      ghsa_id: ghsa, cve_id: shared?.id ?? (i % 2 ? `CVE-2026-${50000 + i}` : null),
      html_url: `https://github.com/advisories/${ghsa}`,
      summary: `${name}: ${pick(kinds)} in request handling`,
      description: `### Impact\n${name} before the patched version is affected.\n`,
      severity: sevOf(score).toLowerCase(), published_at: shared?.published ?? iso(rnd() * 30), updated_at: iso(0),
      cvss_severities: { cvss_v3: { score }, cvss_v4: { score: null } },
      cwes: [{ cwe_id: pick(cwes) }], vulnerabilities: [{ package: { ecosystem: eco, name } }],
    }
  })
  return all.filter((a) => a.published_at.slice(0, 10) >= since).sort((a, b) => b.published_at.localeCompare(a.published_at)).slice(0, 100)
}

const kev = () => ({
  catalogVersion: 'mock', dateReleased: iso(0), count: 0,
  vulnerabilities: [
    ...cves.filter((_, i) => i % 17 === 0).map((c, i) => ({
      cveID: c.id, vendorProject: c.vendor, product: c.product, vulnerabilityName: `${c.vendor} ${c.product} ${c.kind}`,
      dateAdded: c.published.slice(0, 10), shortDescription: `${c.vendor} ${c.product} contains a ${c.kind} vulnerability.`,
      requiredAction: 'Apply mitigations per vendor instructions or discontinue use of the product if mitigations are unavailable.',
      dueDate: new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10),
      knownRansomwareCampaignUse: i % 3 === 0 ? 'Known' : 'Unknown', cwes: [c.cwe],
    })),
    { cveID: 'CVE-2021-44228', vendorProject: 'Apache', product: 'Log4j2', vulnerabilityName: 'Apache Log4j2 RCE', dateAdded: iso(2).slice(0, 10), shortDescription: 'Apache Log4j2 JNDI features do not protect against attacker-controlled LDAP endpoints.', requiredAction: 'Apply updates per vendor instructions.', dueDate: iso(-14).slice(0, 10), knownRansomwareCampaignUse: 'Known', cwes: ['CWE-917'] },
  ],
})

const epss = (url) => ({
  data: (url.searchParams.get('cve') ?? '').split(',').filter(Boolean).map((cve) => {
    const e = Math.pow(rnd(), 4)
    return { cve, epss: e.toFixed(5), percentile: Math.min(0.999, e * 1.6 + rnd() * 0.3).toFixed(5), date: iso(0).slice(0, 10) }
  }),
})

const cveorg = () => ({
  resultsTotal: 40,
  resultsPerPage: 40,
  pageNumber: 1,
  results: cves.slice(0, 40).map((c) => ({
    cveMetadata: {
      cveId: c.id,
      state: 'PUBLISHED',
      datePublished: c.published,
      dateUpdated: c.published,
    },
    containers: {
      cna: {
        title: `${c.vendor} ${c.product} ${c.kind}`,
        descriptions: [{ lang: 'en', value: `Canonical CVE.org record for ${c.kind} in ${c.vendor} ${c.product}.` }],
        affected: [{ vendor: c.vendor, product: c.product }],
        problemTypes: [{ descriptions: [{ cweId: c.cwe, lang: 'en', description: c.cwe }] }],
        references: [{ url: `https://www.cve.org/CVERecord?id=${c.id}` }],
        metrics: c.hasCvss ? [{ cvssV3_1: { baseScore: c.score, baseSeverity: sevOf(c.score), version: '3.1' } }] : [],
      },
    },
  })),
})

const euvd = () => ({
  total: 25,
  items: cves.slice(0, 25).map((c) => ({
    id: `EUVD-2026-${c.id.slice(-5)}`,
    description: `EUVD mirror: ${c.vendor} ${c.product} ${c.kind}`,
    datePublished: c.published,
    dateUpdated: c.published,
    baseScore: c.score,
    baseScoreVersion: '3.1',
    references: `https://example.com/euvd/${c.id}`,
    aliases: c.id,
    assigner: 'mock',
    enisaIdProduct: [{ product: { name: c.product, vendor: { name: c.vendor } }, product_version: '*' }],
  })),
})

const vulncheck = () => ({
  data: cves.filter((_, i) => i % 11 === 0).map((c) => ({
    cve: [c.id],
    vendorProject: c.vendor,
    product: c.product,
    vulnerabilityName: `${c.vendor} ${c.product} ${c.kind}`,
    shortDescription: `${c.vendor} ${c.product} exploited in the wild (mock).`,
    required_action: 'Patch or mitigate according to vendor guidance.',
    knownRansomwareCampaignUse: rnd() > 0.7 ? 'Known' : 'Unknown',
    date_added: c.published,
    dueDate: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    cwes: [c.cwe],
  })),
  meta: { next_cursor: null },
})

const wordfence = () => Object.fromEntries(
  cves.slice(0, 30).map((c, i) => {
    const uuid = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
    return [uuid, {
      id: uuid,
      title: `WordPress plugin mock ${i}: ${c.kind}`,
      description: `Mock Wordfence entry related to ${c.kind}.`,
      published: c.published,
      cve: i % 2 === 0 ? c.id : null,
      references: [`https://www.wordfence.com/threat-intel/vulnerabilities/${uuid}`],
      software: [{ type: 'plugin', name: `mock-plugin-${i}`, slug: `mock-plugin-${i}` }],
      cvss: { score: c.score, rating: sevOf(c.score), vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' },
      cwe: { id: c.cwe, name: c.cwe },
      informational: false,
    }]
  }),
)

const osvBatch = async (req) => {
  let raw = ''
  for await (const chunk of req) raw += chunk
  let count = 1
  try {
    const parsed = JSON.parse(raw || '{}')
    count = Array.isArray(parsed.queries) ? Math.max(1, parsed.queries.length) : 1
  } catch {
    count = 1
  }
  const sample = { vulns: [{ id: 'GHSA-osv1-mock-0001', modified: iso(1) }, { id: cves[0].id, modified: iso(2) }] }
  return { results: Array.from({ length: count }, () => sample) }
}

const osvVuln = (id) => ({
  id,
  summary: `OSV mock for ${id}`,
  details: `Package-level advisory mock for ${id}.`,
  aliases: id.startsWith('GHSA-') ? [cves[1].id] : [],
  published: iso(3),
  modified: iso(0),
  severity: [{ type: 'CVSS_V3', score: '7.5' }],
  affected: [{ package: { ecosystem: 'npm', name: 'lodash' } }],
  references: [{ type: 'ADVISORY', url: `https://osv.dev/vulnerability/${id}` }],
  database_specific: { severity: 'HIGH', cwe_ids: ['CWE-79'] },
})

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  let body = null
  if (url.pathname.startsWith('/rest/json/cves')) body = nvd(url)
  else if (url.pathname.includes('known_exploited')) body = kev()
  else if (url.pathname.startsWith('/advisories')) body = github(url)
  else if (url.pathname.startsWith('/data/v1/epss')) body = epss(url)
  else if (url.pathname.startsWith('/restapiv1/search')) body = cveorg()
  else if (url.pathname.startsWith('/api/search')) body = euvd()
  else if (url.pathname.includes('vulncheck-kev')) body = vulncheck()
  else if (url.pathname.includes('/intelligence/v3/vulnerabilities')) body = wordfence()
  else if (url.pathname.endsWith('/querybatch') && req.method === 'POST') body = await osvBatch(req)
  else if (url.pathname.includes('/vulns/')) body = osvVuln(url.pathname.split('/').pop())

  res.writeHead(body ? 200 : 404, { 'content-type': 'application/json' }).end(JSON.stringify(body ?? { error: 'not found' }))
}).listen(port, () => console.log(`Mock upstream → http://localhost:${port}`))
