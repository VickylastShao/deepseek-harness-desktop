'use strict'

const { createHash } = require('node:crypto')
const { copyFile, mkdir, readFile, stat, writeFile } = require('node:fs/promises')
const path = require('node:path')
const tar = require('tar')
const {
  BUNDLED_RUNTIME_ARCHIVE,
  BUNDLED_RUNTIME_MANIFEST,
  BUNDLED_RUNTIME_SCHEMA,
} = require('../src/bundled-runtime.cjs')
const { inspectRuntime } = require('../src/runtime-store.cjs')
const { PACKAGE_NAME } = require('../src/runtime-updater.cjs')

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
  const bundleDir = path.resolve(
    process.env.RUNTIME_BUNDLE_DIR ?? path.join(projectRoot, 'build', 'packaged-runtime'),
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
    schemaVersion: BUNDLED_RUNTIME_SCHEMA,
    package: PACKAGE_NAME,
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
  await mkdir(bundleDir, { recursive: true })
  const bundledArchive = path.join(bundleDir, BUNDLED_RUNTIME_ARCHIVE)
  const bundledManifest = path.join(bundleDir, BUNDLED_RUNTIME_MANIFEST)
  await copyFile(archive, bundledArchive)
  await writeFile(bundledManifest, `${JSON.stringify({
    ...fragment,
    filename: BUNDLED_RUNTIME_ARCHIVE,
  }, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({
    archive,
    fragmentPath,
    bundledArchive,
    bundledManifest,
    ...fragment,
  }, null, 2))
}

if (require.main === module) {
  main().catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}

module.exports = { main, sha256 }
