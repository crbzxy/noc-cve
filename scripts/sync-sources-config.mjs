// Copia config/sources.json → public/config/sources.json (SSOT → browser).
import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const source = join(root, 'config', 'sources.json')
const target = join(root, 'public', 'config', 'sources.json')

await mkdir(dirname(target), { recursive: true })
await copyFile(source, target)
console.log('Synced config/sources.json → public/config/sources.json')
