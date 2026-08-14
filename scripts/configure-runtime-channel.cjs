'use strict'

const { readFile, writeFile } = require('node:fs/promises')
const path = require('node:path')

async function main() {
  const value = process.argv[2]
  const url = new URL(value)
  if (url.protocol !== 'https:') throw new Error('Runtime channel URL must use HTTPS.')
  const manifestPath = path.resolve(__dirname, '..', 'package.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  manifest.runtimeChannel = url.href
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log(`Embedded runtime channel: ${url.href}`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
