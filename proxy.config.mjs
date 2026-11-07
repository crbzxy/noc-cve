// Upstreams compartidos por el proxy de Vite (dev) y server/index.mjs (prod).
// Las llaves viven SOLO del lado servidor: nunca se exponen al bundle.
// MOCK_UPSTREAM=http://localhost:4010 redirige todas las fuentes al servidor demo (scripts/mock-upstream.mjs)
const mock = globalThis.process?.env?.MOCK_UPSTREAM
const t = (url) => mock ?? url

export const upstreams = {
  '/api/nvd': {
    target: t('https://services.nvd.nist.gov'),
    path: '/rest/json/cves/2.0',
    headers: (env) => (env.NVD_API_KEY ? { apiKey: env.NVD_API_KEY } : {}),
  },
  '/api/kev': {
    target: t('https://www.cisa.gov'),
    path: '/sites/default/files/feeds/known_exploited_vulnerabilities.json',
    headers: () => ({}),
  },
  '/api/github': {
    target: t('https://api.github.com'),
    path: '',
    headers: (env) => ({
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'noc-cve-dashboard',
      ...(env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}),
    }),
  },
  '/api/epss': {
    target: t('https://api.first.org'),
    path: '/data/v1/epss',
    headers: () => ({}),
  },
}
