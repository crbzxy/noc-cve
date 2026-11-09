// Genera certs/cert.pem + certs/key.pem si no existen.
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const certPath = join(root, 'certs', 'cert.pem')
const keyPath = join(root, 'certs', 'key.pem')

if (existsSync(certPath) && existsSync(keyPath)) {
  console.log('TLS ya existe en certs/cert.pem')
  process.exit(0)
}

if (process.platform === 'win32') {
  const script = join(root, 'scripts', 'ensure-tls-certs.ps1')
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script],
    { encoding: 'utf8' },
  )
  process.stdout.write(result.stdout || '')
  process.stderr.write(result.stderr || '')
  if (result.status === 0 && existsSync(certPath) && existsSync(keyPath)) process.exit(0)
  console.warn('No se pudo generar TLS en este host. Coloca certs/cert.pem y certs/key.pem manualmente.')
  process.exit(0)
}

const result = spawnSync('openssl', [
  'req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-days', '825', '-nodes',
  '-keyout', keyPath, '-out', certPath,
  '-subj', '/CN=noc-cve-dashboard/O=Truper/C=MX',
  '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1,IP:172.21.1.140',
], { encoding: 'utf8' })
process.stdout.write(result.stdout || '')
process.stderr.write(result.stderr || '')
if (result.status === 0 && existsSync(certPath) && existsSync(keyPath)) {
  console.log('TLS generado → certs/cert.pem + certs/key.pem')
  process.exit(0)
}
console.warn('No se pudo generar TLS (openssl). Coloca certs/cert.pem y certs/key.pem manualmente.')
process.exit(0)
