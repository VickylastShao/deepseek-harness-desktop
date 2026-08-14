'use strict'

const { cp, mkdir, readFile, rename, rm } = require('node:fs/promises')
const path = require('node:path')
const { RuntimeUpdater } = require('../src/runtime-updater.cjs')

async function main() {
  const projectRoot = path.resolve(__dirname, '..')
  const nodePackageDir = path.join(projectRoot, 'node_modules', 'node')
  const nodeManifest = JSON.parse(await readFile(path.join(nodePackageDir, 'package.json'), 'utf8'))
  const key = `${process.platform}-${process.arch}`
  const buildRoot = path.resolve(
    process.env.RUNTIME_BUILD_ROOT ?? path.join(projectRoot, 'build', 'runtime-cache', key),
  )
  const seedDir = path.resolve(
    process.env.RUNTIME_SEED_DIR ?? path.join(projectRoot, 'runtime-seed'),
  )
  const nodeExecutable = path.join(
    nodePackageDir,
    'bin',
    process.platform === 'win32' ? 'node.exe' : 'node',
  )
  const updater = new RuntimeUpdater({
    rootDir: buildRoot,
    runtimeExecutable: nodeExecutable,
    npmCliPath: path.join(projectRoot, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    nodeVersion: nodeManifest.version,
    registry: process.env.DSH_NPM_REGISTRY,
  })
  const runtime = await updater.prepareLatest(undefined, status => {
    console.log(`[${status.phase}] ${status.message}`)
  })
  if (runtime === undefined) throw new Error('Build-time updater did not produce a runtime seed.')

  await mkdir(path.dirname(seedDir), { recursive: true })
  const temporary = `${seedDir}.${process.pid}.tmp`
  await rm(temporary, { recursive: true, force: true })
  await cp(runtime.rootDir, temporary, { recursive: true, preserveTimestamps: true })
  await rm(seedDir, { recursive: true, force: true })
  await rename(temporary, seedDir)
  console.log(JSON.stringify({
    version: runtime.version,
    node: nodeManifest.version,
    platform: key,
    seedDir,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
