// Servidor demo: imita NVD, CISA KEV, GitHub Advisories y EPSS con datos sintéticos.
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
    const shared = i % 3 === 0 ? cves[i] : null // ~1/3 comparten CVE con NVD → prueba la fusión
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

createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  const body =
    url.pathname.startsWith('/rest/json/cves') ? nvd(url)
    : url.pathname.includes('known_exploited') ? kev()
    : url.pathname.startsWith('/advisories') ? github(url)
    : url.pathname.startsWith('/data/v1/epss') ? epss(url)
    : null
  res.writeHead(body ? 200 : 404, { 'content-type': 'application/json' }).end(JSON.stringify(body ?? { error: 'not found' }))
}).listen(port, () => console.log(`Mock upstream → http://localhost:${port}`))
