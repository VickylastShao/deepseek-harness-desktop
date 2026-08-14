'use strict'

const { mkdtemp, readFile, rm } = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { HarnessProcess } = require('../src/harness-process.cjs')
const { inspectRuntime } = require('../src/runtime-store.cjs')

async function main() {
  const resourcesDir = path.resolve(process.argv[2])
  const nodeRoot = path.join(resourcesDir, 'node-runtime')
  const nodeManifest = JSON.parse(await readFile(path.join(nodeRoot, 'package.json'), 'utf8'))
  const nodeExecutable = path.join(nodeRoot, 'bin', process.platform === 'win32' ? 'node.exe' : 'node')
  const runtime = await inspectRuntime(path.join(resourcesDir, 'runtime-seed'), nodeManifest.version)
  if (runtime === undefined) throw new Error('Packaged runtime seed is absent or invalid.')

  const temporary = await mkdtemp(path.join(os.tmpdir(), 'dsh-packaged-verify-'))
  const harness = new HarnessProcess({
    runtimeExecutable: nodeExecutable,
    binPath: runtime.binPath,
    cwd: temporary,
    dshHome: path.join(temporary, 'dsh-home'),
  })
  try {
    const url = await harness.start()
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    const html = await response.text()
    if (!response.ok || !html.toLowerCase().includes('<!doctype html>')) {
      throw new Error(`Packaged Harness HTTP check failed: ${response.status}.`)
    }
    console.log(JSON.stringify({
      resourcesDir,
      harness: runtime.version,
      node: nodeManifest.version,
      url,
      status: response.status,
    }, null, 2))
  } finally {
    await harness.stop()
    await rm(temporary, { recursive: true, force: true })
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
