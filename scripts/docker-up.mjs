/**
 * Arranque Docker Compose del dashboard (local o server Truper).
 * - Crea .env desde .env.example si falta
 * - Asegura carpeta certs/
 * - docker compose up --build [--detach]
 */
import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env')
const examplePath = join(root, '.env.example')
const certsPath = join(root, 'certs')
const detached = process.argv.includes('--detach') || process.argv.includes('-d')

if (!existsSync(envPath)) {
  if (!existsSync(examplePath)) {
    console.error('Falta .env y .env.example — no se puede arrancar.')
    process.exit(1)
  }
  copyFileSync(examplePath, envPath)
  console.log('Creado .env desde .env.example — revisa DASHBOARD_USER / DASHBOARD_PASS.')
}

mkdirSync(certsPath, { recursive: true })

const args = ['compose', 'up', '--build']
if (detached) args.push('-d')

console.log(`→ docker ${args.join(' ')}`)
console.log(detached
  ? 'URL: http://<host>:8082  (detached)'
  : 'URL: http://localhost:8082  (Ctrl+C detiene el contenedor)')

const child = spawn('docker', args, {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})

child.on('error', (error) => {
  console.error('No se pudo ejecutar docker. ¿Docker Desktop / daemon activo?', error.message)
  process.exit(1)
})
