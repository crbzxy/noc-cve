/**
 * Homologa tecnologia / framework / base de datos según el glosario del inventario.
 * Uso: node scripts/normalize-apps-glossary.mjs
 */
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const configPath = join(root, 'config/apps.json')
const publicPath = join(root, 'public/config/apps.json')

function normalizeSemverFragment(raw) {
  const text = String(raw).replace(/\.RELEASE$/i, '').trim()
  // Typos: 3.04 -> 3.0.4, 2.3.04 -> 2.3.4
  const twoPartOdd = text.match(/^(\d+)\.0(\d)$/)
  if (twoPartOdd) return `${twoPartOdd[1]}.0.${twoPartOdd[2]}`
  const threePartOdd = text.match(/^(\d+)\.(\d+)\.0(\d+)$/)
  if (threePartOdd) return `${threePartOdd[1]}.${threePartOdd[2]}.${threePartOdd[3]}`
  return text
}

function extractSpringBootVersion(text) {
  const match = String(text).match(
    /(?:spring[-\s]?boot(?:-starter-parent)?|spring boot)\s*[:\s]*([\d]+(?:\.[\d]+)*(?:\.RELEASE)?)/i,
  )
  if (!match) return null
  return normalizeSemverFragment(match[1])
}

function inferSpringBootFromLibs(libs) {
  const versions = []
  for (const lib of libs) {
    const text = String(lib)
    const match = text.match(/spring-boot(?:-[a-z0-9-]+)?:(?:jar:)?(\d+\.\d+\.\d+)/i)
      || text.match(/spring-boot-starter[^\s_:]*[_:\s]+(\d+\.\d+\.\d+)/i)
    if (match) versions.push(match[1])
  }
  if (versions.length === 0) return null
  const counts = new Map()
  for (const version of versions) counts.set(version, (counts.get(version) || 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

function normalizeTechnology(raw) {
  const text = String(raw || '').trim()
  if (!text) return text
  if (/^java\s*\(n\/d\)$/i.test(text) || /^java$/i.test(text)) return 'Java'
  const java18 = text.match(/^java\s*(?:1\.)?8\b/i)
  if (java18) return 'Java 8'
  const javaMajor = text.match(/^java\s+(\d+)\b/i)
  if (javaMajor) return `Java ${javaMajor[1]}`
  const php = text.match(/^php\s+(\d+(?:\.\d+)?)\b/i)
  if (php) return `PHP ${php[1]}`
  if (/^php$/i.test(text)) return 'PHP'
  return text
}

function normalizeFramework(raw, libs) {
  const text = String(raw || '').trim()
  if (/^magento\b/i.test(text)) {
    const version = text.replace(/^magento\s+/i, '').trim()
    return version ? `Magento ${version}` : 'Magento'
  }
  if (/^wordpress\b/i.test(text)) {
    const version = text.replace(/^wordpress\s+/i, '').trim()
    return version ? `WordPress ${version}` : 'WordPress'
  }

  const springFrameworkOnly = text.match(/^spring(?:\s+framework)?\s+(\d+\.\d+\.\d+)\b/i)
  if (springFrameworkOnly && !/boot/i.test(text)) {
    return `Spring Framework ${springFrameworkOnly[1]}`
  }

  let bootVersion = extractSpringBootVersion(text)
  if (!bootVersion && (/^libre$/i.test(text) || /^n\/d$/i.test(text) || text === '')) {
    bootVersion = inferSpringBootFromLibs(libs)
  }
  if (bootVersion) return `Spring Boot ${bootVersion}`
  if (/^libre$/i.test(text) || /^n\/d$/i.test(text)) return 'Desconocido'
  if (/spring/i.test(text)) {
    const loose = text.match(/([\d]+(?:\.[\d]+)+)/)
    if (loose) return `Spring Boot ${normalizeSemverFragment(loose[1])}`
  }
  return text || 'Desconocido'
}

function normalizeDatabase(raw) {
  const text = String(raw || '').trim()
  if (!text) return text

  if (/^sql\s*2019$/i.test(text) || /^sql\s*server\s*2019$/i.test(text)) return 'SQL Server 2019'
  if (/^sql\s*server$/i.test(text) || /^mssql$/i.test(text) || /^sql$/i.test(text)) return 'SQL Server'

  if (/^mongo(?:db)?\s*4\.6(?:\.1)?$/i.test(text)) return 'MongoDB'
  if (/^mongo(?:db)?\s*6(?:\.0)?$/i.test(text)) return 'MongoDB 6'
  if (/^mongo(?:db)?$/i.test(text)) return 'MongoDB'

  if (/^redis\s*7(?:\.0)?$/i.test(text)) return 'Redis 7'
  if (/^redis$/i.test(text)) return 'Redis'

  if (/^mysql$/i.test(text)) return 'MySQL'
  if (/^mariadb\s*11(?:\.0)?$/i.test(text)) return 'MariaDB 11'
  if (/^mariadb$/i.test(text)) return 'MariaDB'
  if (/^opensearch$/i.test(text)) return 'OpenSearch'
  if (/^elasticsearch$/i.test(text)) return 'Elasticsearch'
  if (/^sap$/i.test(text)) return 'SAP'

  return text
}

function normalizeEntry(entry) {
  const libs = entry.librerias || []
  return {
    ...entry,
    tecnologia: normalizeTechnology(entry.tecnologia),
    framework: normalizeFramework(entry.framework, libs),
    'base de datos': (entry['base de datos'] || []).map(normalizeDatabase),
  }
}

const document = JSON.parse(readFileSync(configPath, 'utf8'))
const changes = []

for (const [label, entry] of Object.entries(document.apps)) {
  const next = normalizeEntry(entry)
  const before = {
    tecnologia: entry.tecnologia,
    framework: entry.framework,
    databases: entry['base de datos'],
  }
  const after = {
    tecnologia: next.tecnologia,
    framework: next.framework,
    databases: next['base de datos'],
  }
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    changes.push({ label, before, after })
    document.apps[label] = next
  }
}

writeFileSync(configPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8')
copyFileSync(configPath, publicPath)

console.log(JSON.stringify({
  changedApps: changes.length,
  sample: changes.slice(0, 15),
  totals: {
    tecnologias: summarize(Object.values(document.apps).map((entry) => entry.tecnologia)),
    frameworks: summarize(Object.values(document.apps).map((entry) => entry.framework)),
    databases: summarize(Object.values(document.apps).flatMap((entry) => entry['base de datos'] || [])),
  },
}, null, 2))

function summarize(values) {
  const counts = new Map()
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1)
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])))
}
