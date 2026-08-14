'use strict'

const { mkdtemp } = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { RuntimeUpdater } = require('../src/runtime-updater.cjs')

async function main() {
  const rootDir = process.env.DSH_RUNTIME_TEST_ROOT
    ?? await mkdtemp(path.join(os.tmpdir(), 'dsh-desktop-smoke-'))
  const updater = new RuntimeUpdater({
    rootDir,
    runtimeExecutable: process.execPath,
    registry: process.env.DSH_NPM_REGISTRY,
  })
  const runtime = await updater.ensureLatest(status => console.log(`[${status.phase}] ${status.message}`))
  console.log(JSON.stringify({
    version: runtime.version,
    integrity: runtime.integrity,
    binPath: runtime.binPath,
    rootDir,
    node: process.versions.node,
    electron: process.versions.electron,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
