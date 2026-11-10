import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const apps = JSON.parse(readFileSync(join(root, 'config/apps.json'), 'utf8')).apps

const { resolveAppStack, trackLibrary } = await import(
  pathToFileURL(join(root, 'src/lib/resolveAppStack.ts')).href
)

const TECH_OK = /^(Java(?: \d+)?|PHP(?: \d+(?:\.\d+)?))$/
const FRAMEWORK_OK = /^(Spring Boot \d+\.\d+\.\d+|Spring Framework \d+\.\d+\.\d+|Magento .+|WordPress .+|Desconocido)$/
const DATABASE_OK = /^(SQL Server(?: \d{4})?|MongoDB(?: \d+)?|Redis(?: \d+)?|MySQL|MariaDB(?: \d+)?|OpenSearch|Elasticsearch|SAP)$/

const issues = []

function push(label, type, extra = {}) {
  issues.push({ label, type, ...extra })
}

for (const [label, entry] of Object.entries(apps)) {
  const fw = entry.framework || ''
  const tech = entry.tecnologia || ''
  const libs = entry.librerias || []
  const dbs = entry['base de datos'] || []
  const libText = libs.join(' ').toLowerCase()

  if (!TECH_OK.test(tech)) push(label, 'glossary-tech', { tech })
  if (!FRAMEWORK_OK.test(fw)) push(label, 'glossary-framework', { fw })
  for (const database of dbs) {
    if (!DATABASE_OK.test(database)) push(label, 'glossary-database', { database })
  }

  const bootFromFw = fw.match(/Spring Boot (\d+\.\d+\.\d+)/)
  const bootFromLibs = []
  for (const lib of libs) {
    const text = String(lib)
    const match = text.match(/spring-boot(?:-[a-z0-9-]+)?:(?:jar:)?(\d+\.\d+\.\d+)/i)
      || text.match(/spring-boot-starter[^\s_]*[_\s](\d+\.\d+\.\d+)/i)
    if (match) bootFromLibs.push(match[1])
  }
  const uniqueBoot = [...new Set(bootFromLibs)]
  if (bootFromFw && uniqueBoot.length > 0) {
    const frameworkMinor = bootFromFw[1].split('.').slice(0, 2).join('.')
    const libMinors = new Set(uniqueBoot.map((version) => version.split('.').slice(0, 2).join('.')))
    if (![...libMinors].some((minor) => minor === frameworkMinor)) {
      push(label, 'framework-vs-libs', { fw, libBoot: uniqueBoot.slice(0, 6) })
    }
  }

  if (/mongo/i.test(libText) && !dbs.some((database) => /mongo/i.test(database))) {
    push(label, 'missing-db-mongo', { dbs })
  }
  if (/redis|jedis|jrejson|redis-om/i.test(libText) && !dbs.some((database) => /redis/i.test(database))) {
    push(label, 'missing-db-redis', { dbs })
  }
  if (libs.length > 0 && libs.length <= 3 && /spring/i.test(fw)) {
    push(label, 'sparse-libs', { count: libs.length })
  }
  const snapshots = libs.filter((lib) => /snapshot/i.test(String(lib)))
  if (snapshots.length >= 2) push(label, 'many-snapshots', { count: snapshots.length })

  const tracked = libs.map((lib) => trackLibrary(lib)).filter(Boolean)
  const unversioned = tracked.filter((library) => library.kind === 'queryable' && !library.version)
  if (unversioned.length >= 8) {
    push(label, 'many-unversioned', {
      count: unversioned.length,
      sample: unversioned.slice(0, 4).map((library) => library.displayName),
    })
  }
  if (fw === 'Desconocido') push(label, 'unknown-framework', { tech, fw })
}

const byType = Object.create(null)
for (const issue of issues) {
  byType[issue.type] ??= []
  byType[issue.type].push(issue)
}

const sampleLabels = [
  'TEL',
  'truper.com',
  'manzanillas.mx',
  'met-WebWS',
  'truperenlinea-bonos',
]

console.log(JSON.stringify({
  totalApps: Object.keys(apps).length,
  issueCount: issues.length,
  glossaryViolations: {
    tech: (byType['glossary-tech'] || []).length,
    framework: (byType['glossary-framework'] || []).length,
    database: (byType['glossary-database'] || []).length,
  },
  byType: Object.fromEntries(
    Object.entries(byType).map(([type, rows]) => [
      type,
      rows.map((row) => ({
        label: row.label,
        ...Object.fromEntries(
          Object.entries(row).filter(([key]) => key !== 'label' && key !== 'type'),
        ),
      })),
    ]),
  ),
  resolveSmoke: sampleLabels.map((label) => {
    const stack = resolveAppStack(apps[label])
    return {
      label,
      tecnologia: apps[label].tecnologia,
      framework: apps[label].framework,
      databases: apps[label]['base de datos'],
      primaryTechIds: stack.primaryTechIds,
      scopeTechIds: stack.scopeTechIds,
      techIds: stack.techIds,
      libs: stack.libraries.length,
    }
  }),
}, null, 2))
