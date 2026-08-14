'use strict'

const assert = require('node:assert/strict')
const { mkdir, mkdtemp, readFile, writeFile } = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const {
  PACKAGE_NAME,
  READY_MARKER,
  RuntimeUpdater,
  assertNodeCompatibility,
  fetchLatestManifest,
  harnessBin,
} = require('../src/runtime-updater.cjs')

function manifest(version = '1.2.3') {
  return {
    name: PACKAGE_NAME,
    version,
    dist: { integrity: `sha512-${version}` },
  }
}

async function writeFakePackage(rootDir, value) {
  const packageDir = path.join(rootDir, 'node_modules', '@deepseek-ai', 'dsh')
  await mkdir(path.join(packageDir, 'lib'), { recursive: true })
  await writeFile(path.join(packageDir, 'package.json'), JSON.stringify({
    name: PACKAGE_NAME,
    version: value.version,
  }))
  await writeFile(path.join(packageDir, 'lib', 'bin.js'), '#!/usr/bin/env node\n')
}

test('fetchLatestManifest uses the official latest endpoint and validates integrity', async () => {
  let requested
  const value = manifest()
  const result = await fetchLatestManifest({
    fetchImpl: async (url) => {
      requested = url.href
      return { ok: true, json: async () => value }
    },
  })
  assert.equal(requested, 'https://registry.npmjs.org/@deepseek-ai%2Fdsh/latest')
  assert.deepEqual(result, value)
})

test('strict update fails when the registry cannot be checked even if a cached version exists', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'dsh-updater-strict-'))
  const updater = new RuntimeUpdater({
    rootDir,
    runtimeExecutable: '/fake/electron',
    fetchManifest: async () => { throw new Error('offline') },
    installVersion: async () => assert.fail('installer must not run'),
    runSmokeTest: async () => assert.fail('smoke test must not run'),
  })
  await assert.rejects(updater.ensureLatest(), /offline/)
})

test('a verified current version is reused after the mandatory registry check', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'dsh-updater-ready-'))
  const value = manifest('2.0.0')
  const versionDir = path.join(rootDir, 'versions', value.version)
  await writeFakePackage(versionDir, value)
  await writeFile(path.join(versionDir, READY_MARKER), JSON.stringify({
    package: PACKAGE_NAME,
    version: value.version,
    integrity: value.dist.integrity,
  }))

  const updater = new RuntimeUpdater({
    rootDir,
    runtimeExecutable: '/fake/electron',
    fetchManifest: async () => value,
    installVersion: async () => assert.fail('installer must not run'),
    runSmokeTest: async () => assert.fail('smoke test must not run'),
  })
  const result = await updater.ensureLatest()
  assert.equal(result.binPath, harnessBin(versionDir))
  assert.equal(result.version, value.version)
})

test('a new version is installed, verified, and atomically activated', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'dsh-updater-install-'))
  const value = manifest('3.4.5')
  let smokeBin
  const statuses = []
  const updater = new RuntimeUpdater({
    rootDir,
    runtimeExecutable: '/fake/electron',
    fetchManifest: async () => value,
    installVersion: async (stageDir, received) => writeFakePackage(stageDir, received),
    runSmokeTest: async (_runtime, binPath) => { smokeBin = binPath },
  })

  const result = await updater.ensureLatest(status => statuses.push(status.phase))
  assert.deepEqual(statuses, ['checking', 'installing', 'verifying', 'ready'])
  assert.match(smokeBin, /staging/)
  assert.equal(result.version, value.version)
  assert.equal(result.binPath, harnessBin(path.join(rootDir, 'versions', value.version)))
  const marker = JSON.parse(await readFile(
    path.join(rootDir, 'versions', value.version, READY_MARKER),
    'utf8',
  ))
  assert.equal(marker.integrity, value.dist.integrity)
})

test('Node engine incompatibility blocks activation', () => {
  assert.throws(
    () => assertNodeCompatibility({ version: '9.0.0', engines: { node: '>=30' } }, '24.18.1'),
    /requires Node >=30/,
  )
})
