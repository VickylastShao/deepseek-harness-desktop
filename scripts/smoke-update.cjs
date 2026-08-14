'use strict'

const { mkdtemp } = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { RuntimeUpdater } = require('../src/runtime-updater.cjs')

async function main() {
  const projectRoot = path.resolve(__dirname, '..')
  const nodePackageDir = path.join(projectRoot, 'node_modules', 'node')
  const nodeManifest = require(path.join(nodePackageDir, 'package.json'))
  const rootDir = process.env.DSH_RUNTIME_TEST_ROOT
    ?? await mkdtemp(path.join(os.tmpdir(), 'dsh-desktop-smoke-'))
  const updater = new RuntimeUpdater({
    rootDir,
    runtimeExecutable: path.join(nodePackageDir, 'bin', process.platform === 'win32' ? 'node.exe' : 'node'),
    npmCliPath: path.join(projectRoot, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    nodeVersion: nodeManifest.version,
    registry: process.env.DSH_NPM_REGISTRY,
  })
  const runtime = await updater.prepareLatest(
    process.env.DSH_CURRENT_VERSION,
    status => console.log(`[${status.phase}] ${status.message}`),
  )
  if (runtime === undefined) {
    console.log(JSON.stringify({ current: process.env.DSH_CURRENT_VERSION }, null, 2))
    return
  }
  console.log(JSON.stringify({
    version: runtime.version,
    integrity: runtime.integrity,
    binPath: runtime.binPath,
    rootDir,
    node: nodeManifest.version,
    electron: process.versions.electron,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
