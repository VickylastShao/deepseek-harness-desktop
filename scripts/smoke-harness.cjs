'use strict'

const { mkdtemp } = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { HarnessProcess } = require('../src/harness-process.cjs')
const { RuntimeUpdater } = require('../src/runtime-updater.cjs')

async function main() {
  const projectRoot = path.resolve(__dirname, '..')
  const nodePackageDir = path.join(projectRoot, 'node_modules', 'node')
  const nodeExecutable = path.join(nodePackageDir, 'bin', process.platform === 'win32' ? 'node.exe' : 'node')
  const nodeManifest = require(path.join(nodePackageDir, 'package.json'))
  const base = await mkdtemp(path.join(os.tmpdir(), 'dsh-desktop-e2e-'))
  const runtimeRoot = process.env.DSH_RUNTIME_TEST_ROOT ?? path.join(base, 'runtime')
  const updater = new RuntimeUpdater({
    rootDir: runtimeRoot,
    runtimeExecutable: nodeExecutable,
    npmCliPath: path.join(projectRoot, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    nodeVersion: nodeManifest.version,
    registry: process.env.DSH_NPM_REGISTRY,
  })
  const runtime = await updater.prepareLatest(
    undefined,
    status => console.log(`[${status.phase}] ${status.message}`),
  )
  if (runtime === undefined) throw new Error('Harness smoke test did not resolve a runtime.')
  const logs = []
  const harness = new HarnessProcess({
    runtimeExecutable: nodeExecutable,
    binPath: runtime.binPath,
    cwd: base,
    dshHome: path.join(base, 'dsh-home'),
    onLog: (source, value) => logs.push(`[${source}] ${value}`),
  })

  try {
    const url = await harness.start()
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    const body = await response.text()
    if (!response.ok || !body.toLowerCase().includes('<!doctype html>')) {
      throw new Error(`Harness HTTP smoke test failed: ${response.status}`)
    }
    console.log(JSON.stringify({ version: runtime.version, url, status: response.status }, null, 2))
  } catch (error) {
    console.error(logs.join(''))
    throw error
  } finally {
    await harness.stop()
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
