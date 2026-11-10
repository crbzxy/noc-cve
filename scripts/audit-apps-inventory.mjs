import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const apps = JSON.parse(readFileSync(join(root, 'config/apps.json'), 'utf8')).apps

const { resolveAppStack, trackLibrary } = await import(
  pathToFileURL(join(root, 'src/lib/resolveAppStack.ts')).href
)

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

  const bootFromFw = fw.match(/(\d+\.\d+(?:\.\d+)?)/)
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
    if (![...libMinors].some((minor) => minor === frameworkMinor || frameworkMinor.startsWith(minor))) {
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
  if (/N\/D/i.test(tech) || fw === 'libre' || /N\/D/i.test(fw)) {
    push(label, 'unknown-tech-or-fw', { tech, fw })
  }
  for (const database of dbs) {
    if (/mongo\s*4\.6/i.test(database)) {
      push(label, 'mongo-version-looks-like-driver', { database })
    }
  }
  if (/^Spring boot 3\.0\d$/i.test(fw) || /^Spring boot 2\.3\.0\d$/i.test(fw)) {
    push(label, 'suspicious-framework-format', { fw })
  }
}

const byType = Object.create(null)
for (const issue of issues) {
  byType[issue.type] ??= []
  byType[issue.type].push(issue)
}

console.log(JSON.stringify({
  totalApps: Object.keys(apps).length,
  issueCount: issues.length,
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
  webApps: ['truper.com', 'Fix Ferreterias', 'manzanillas.mx'].map((label) => {
    const stack = resolveAppStack(apps[label])
    return {
      label,
      technology: apps[label].tecnologia,
      framework: apps[label].framework,
      primaryTechIds: stack.primaryTechIds,
      scopeTechIds: stack.scopeTechIds,
      libs: stack.libraries.length,
      versionedWatched: stack.watchedPackages.filter((pkg) => Boolean(pkg.version)).length,
    }
  }),
}, null, 2))
