// Copia SSOT → public/config (browser).
import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const publicConfig = join(root, 'public', 'config')

await mkdir(publicConfig, { recursive: true })

const files = ['sources.json', 'apps.json']
for (const file of files) {
  const source = join(root, 'config', file)
  const target = join(publicConfig, file)
  try {
    await copyFile(source, target)
    console.log(`Synced config/${file} → public/config/${file}`)
  } catch (error) {
    if (file === 'apps.json') {
      console.warn(`Skip sync ${file}: aún no existe en config/`)
      continue
    }
    throw error
  }
}
