'use strict'

const { createHash } = require('node:crypto')
const { mkdir, readFile, stat, writeFile } = require('node:fs/promises')
const path = require('node:path')
const tar = require('tar')
const { inspectRuntime } = require('../src/runtime-store.cjs')

async function sha256(filename) {
  return createHash('sha256').update(await readFile(filename)).digest('hex')
}

async function main() {
  const projectRoot = path.resolve(__dirname, '..')
  const nodeManifest = JSON.parse(await readFile(
    path.join(projectRoot, 'node_modules', 'node', 'package.json'),
    'utf8',
  ))
  const seedDir = path.resolve(process.env.RUNTIME_SEED_DIR ?? path.join(projectRoot, 'runtime-seed'))
  const outputDir = path.resolve(
    process.env.RUNTIME_RELEASE_DIR ?? path.join(projectRoot, 'runtime-release'),
  )
  const runtime = await inspectRuntime(seedDir, nodeManifest.version)
  if (runtime === undefined) throw new Error('Runtime seed is absent or has not passed verification.')

  const key = `${process.platform}-${process.arch}`
  const filename = `deepseek-harness-runtime-${runtime.version}-${key}.tgz`
  await mkdir(outputDir, { recursive: true })
  const archive = path.join(outputDir, filename)
  await tar.c({ cwd: seedDir, file: archive, gzip: true, portable: true }, ['.'])
  const details = await stat(archive)
  const fragment = {
    schemaVersion: 1,
    version: runtime.version,
    npmIntegrity: runtime.integrity,
    node: nodeManifest.version,
    key,
    filename,
    sha256: await sha256(archive),
    size: details.size,
  }
  const fragmentPath = path.join(outputDir, `runtime-${key}.fragment.json`)
  await writeFile(fragmentPath, `${JSON.stringify(fragment, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ archive, fragmentPath, ...fragment }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
