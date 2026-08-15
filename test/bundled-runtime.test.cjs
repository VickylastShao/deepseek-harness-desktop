'use strict'

const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const { mkdir, mkdtemp, readFile, writeFile } = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const tar = require('tar')
const {
  prepareBundledRuntime,
  renameWithRetry,
  validateBundledManifest,
} = require('../src/bundled-runtime.cjs')
const {
  INSTALLER_ID,
  PACKAGE_NAME,
  READY_MARKER,
} = require('../src/runtime-updater.cjs')

const NODE_VERSION = '24.18.1'
const KEY = 'linux-x64'

async function fixture(version = '1.2.3') {
  const base = await mkdtemp(path.join(os.tmpdir(), 'dsh-bundled-runtime-'))
  const source = path.join(base, 'source')
  const packageDir = path.join(source, 'node_modules', '@deepseek-ai', 'dsh', 'lib')
  await mkdir(packageDir, { recursive: true })
  await writeFile(path.join(packageDir, 'bin.js'), '#!/usr/bin/env node\n')
  await writeFile(path.join(source, READY_MARKER), `${JSON.stringify({
    package: PACKAGE_NAME,
    version,
    integrity: `sha512-${version}`,
    installer: INSTALLER_ID,
    node: NODE_VERSION,
  })}\n`)

  const bundleDir = path.join(base, 'bundle')
  await mkdir(bundleDir)
  const archive = path.join(bundleDir, 'runtime.tgz')
  await tar.c({ cwd: source, file: archive, gzip: true }, ['.'])
  const body = await readFile(archive)
  const manifest = {
    schemaVersion: 1,
    package: PACKAGE_NAME,
    version,
    npmIntegrity: `sha512-${version}`,
    node: NODE_VERSION,
    key: KEY,
    filename: 'runtime.tgz',
    sha256: createHash('sha256').update(body).digest('hex'),
    size: body.length,
  }
  await writeFile(path.join(bundleDir, 'runtime.json'), `${JSON.stringify(manifest)}\n`)
  return { base, bundleDir, manifest }
}

test('bundled manifest is bound to this package, platform, Node, archive name, size, and SHA-256', () => {
  const manifest = {
    schemaVersion: 1,
    package: PACKAGE_NAME,
    version: '1.2.3',
    npmIntegrity: 'sha512-runtime',
    node: NODE_VERSION,
    key: KEY,
    filename: 'runtime.tgz',
    sha256: 'a'.repeat(64),
    size: 42,
  }
  assert.deepEqual(validateBundledManifest(manifest, {
    nodeVersion: NODE_VERSION,
    platformKey: KEY,
  }), manifest)
  assert.throws(() => validateBundledManifest({ ...manifest, key: 'win32-x64' }, {
    nodeVersion: NODE_VERSION,
    platformKey: KEY,
  }), /incompatible/u)
  assert.throws(() => validateBundledManifest({ ...manifest, filename: '../runtime.tgz' }, {
    nodeVersion: NODE_VERSION,
    platformKey: KEY,
  }), /incompatible/u)
})

test('Windows activation retries transient directory rename failures', async () => {
  let attempts = 0
  const delays = []
  await renameWithRetry('staging', 'bundled', {
    platform: 'win32',
    renameImpl: async () => {
      attempts += 1
      if (attempts < 3) throw Object.assign(new Error('temporarily locked'), { code: 'EPERM' })
    },
    waitImpl: async delayMs => { delays.push(delayMs) },
    retryDelayMs: 25,
  })
  assert.equal(attempts, 3)
  assert.deepEqual(delays, [25, 50])
})

test('activation does not retry permanent errors or non-Windows failures', async () => {
  let attempts = 0
  await assert.rejects(renameWithRetry('staging', 'bundled', {
    platform: 'win32',
    renameImpl: async () => {
      attempts += 1
      throw Object.assign(new Error('invalid target'), { code: 'EINVAL' })
    },
    waitImpl: async () => {},
  }), /invalid target/u)
  assert.equal(attempts, 1)

  await assert.rejects(renameWithRetry('staging', 'bundled', {
    platform: 'linux',
    renameImpl: async () => {
      attempts += 1
      throw Object.assign(new Error('locked'), { code: 'EPERM' })
    },
    waitImpl: async () => {},
  }), /locked/u)
  assert.equal(attempts, 2)
})

test('first startup verifies, extracts, smoke-tests, and atomically reuses the bundled runtime', async t => {
  const { base, bundleDir } = await fixture()
  t.after(() => require('node:fs/promises').rm(base, { recursive: true, force: true }))
  const statuses = []
  let smokeTests = 0
  const options = {
    bundleDir,
    rootDir: path.join(base, 'managed'),
    runtimeExecutable: '/fake/node',
    nodeVersion: NODE_VERSION,
    platformKey: KEY,
    runSmokeTest: async (_node, binPath, version) => {
      smokeTests += 1
      assert.match(binPath, /staging/u)
      assert.equal(version, '1.2.3')
    },
  }

  const installed = await prepareBundledRuntime(options, status => statuses.push(status.phase))
  assert.equal(installed.version, '1.2.3')
  assert.match(installed.rootDir, /bundled[/\\]1\.2\.3$/u)
  assert.deepEqual(statuses, ['verifying', 'extracting', 'testing', 'ready'])
  assert.equal(smokeTests, 1)

  const reused = await prepareBundledRuntime(options)
  assert.equal(reused.rootDir, installed.rootDir)
  assert.equal(smokeTests, 1)
})

test('a corrupt bundled archive is rejected before extraction or activation', async t => {
  const { base, bundleDir, manifest } = await fixture()
  t.after(() => require('node:fs/promises').rm(base, { recursive: true, force: true }))
  await writeFile(path.join(bundleDir, 'runtime.tgz'), 'corrupt')
  let smokeTests = 0

  await assert.rejects(prepareBundledRuntime({
    bundleDir,
    rootDir: path.join(base, 'managed'),
    runtimeExecutable: '/fake/node',
    nodeVersion: NODE_VERSION,
    platformKey: KEY,
    runSmokeTest: async () => { smokeTests += 1 },
  }), /SHA-256 or size verification/u)
  assert.equal(smokeTests, 0)
  await assert.rejects(readFile(path.join(base, 'managed', 'bundled', manifest.version, READY_MARKER)), /ENOENT/u)
})

test('a runtime that fails its native smoke test is never activated', async t => {
  const { base, bundleDir, manifest } = await fixture()
  t.after(() => require('node:fs/promises').rm(base, { recursive: true, force: true }))

  await assert.rejects(prepareBundledRuntime({
    bundleDir,
    rootDir: path.join(base, 'managed'),
    runtimeExecutable: '/fake/node',
    nodeVersion: NODE_VERSION,
    platformKey: KEY,
    runSmokeTest: async () => { throw new Error('native module failed') },
  }), /native module failed/u)
  await assert.rejects(readFile(path.join(base, 'managed', 'bundled', manifest.version, READY_MARKER)), /ENOENT/u)
})
