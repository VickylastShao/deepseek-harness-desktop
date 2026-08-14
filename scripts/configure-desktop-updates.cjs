'use strict'

const { readFile, writeFile } = require('node:fs/promises')
const path = require('node:path')

async function main() {
  const value = process.argv[2]
  if (value !== 'true' && value !== 'false') {
    throw new Error('Desktop update flag must be true or false.')
  }
  const manifestPath = path.resolve(__dirname, '..', 'package.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  manifest.desktopUpdates = value === 'true'
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log(`Embedded desktop updates: ${manifest.desktopUpdates}`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
