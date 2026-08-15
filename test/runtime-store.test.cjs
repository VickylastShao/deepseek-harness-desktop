'use strict'

const assert = require('node:assert/strict')
const { mkdir, mkdtemp, readFile, writeFile } = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const {
  INSTALLER_ID,
  PACKAGE_NAME,
  READY_MARKER,
} = require('../src/runtime-updater.cjs')
const { RuntimeStore } = require('../src/runtime-store.cjs')

const NODE_VERSION = '24.18.1'

async function fakeRuntime(rootDir, version) {
  const packageDir = path.join(rootDir, 'node_modules', '@deepseek-ai', 'dsh')
  await mkdir(path.join(packageDir, 'lib'), { recursive: true })
  await writeFile(path.join(packageDir, 'lib', 'bin.js'), '#!/usr/bin/env node\n')
  await writeFile(path.join(rootDir, READY_MARKER), JSON.stringify({
    package: PACKAGE_NAME,
    version,
    integrity: `sha512-${version}`,
    installer: INSTALLER_ID,
    node: NODE_VERSION,
  }))
  return {
    version,
    integrity: `sha512-${version}`,
    rootDir,
  }
}

async function fixture() {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'dsh-runtime-store-'))
  const seedDir = path.join(rootDir, 'seed')
  await fakeRuntime(seedDir, '1.0.0')
  return {
    rootDir,
    seedDir,
    store: new RuntimeStore({ rootDir, seedDir, nodeVersion: NODE_VERSION }),
  }
}

test('bundled seed starts immediately when no local pointer exists', async () => {
  const { seedDir, store } = await fixture()
  const runtime = await store.resolveStartupRuntime()
  assert.equal(runtime.version, '1.0.0')
  assert.equal(runtime.rootDir, seedDir)
})

test('a packaged seed archive is prepared lazily only when no managed runtime exists', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'dsh-runtime-store-lazy-'))
  const seedDir = path.join(rootDir, 'bundled', '1.0.0')
  let preparations = 0
  const store = new RuntimeStore({
    rootDir,
    nodeVersion: NODE_VERSION,
    prepareSeed: async () => {
      preparations += 1
      return fakeRuntime(seedDir, '1.0.0')
    },
  })

  const runtime = await store.resolveStartupRuntime()
  assert.equal(runtime.rootDir, seedDir)
  assert.equal(store.seedDir, seedDir)
  assert.equal(preparations, 1)
})

test('a verified active runtime avoids unpacking the bundled fallback', async () => {
  const { rootDir, store } = await fixture()
  const active = await fakeRuntime(path.join(rootDir, 'versions', '1.5.0'), '1.5.0')
  await store.setPending(active)
  await store.resolveStartupRuntime()
  const reloaded = new RuntimeStore({
    rootDir,
    nodeVersion: NODE_VERSION,
    prepareSeed: async () => { throw new Error('bundled fallback should not be prepared') },
  })

  assert.equal((await reloaded.resolveStartupRuntime()).version, '1.5.0')
})

test('a pending update is promoted locally on the next startup', async () => {
  const { rootDir, store } = await fixture()
  const update = await fakeRuntime(path.join(rootDir, 'versions', '1.1.0'), '1.1.0')
  await store.setPending(update)

  const runtime = await store.resolveStartupRuntime()
  assert.equal(runtime.version, '1.1.0')
  const active = JSON.parse(await readFile(path.join(rootDir, 'active.json'), 'utf8'))
  assert.equal(active.version, '1.1.0')
  await assert.rejects(readFile(path.join(rootDir, 'pending.json')), /ENOENT/)
})

test('staging an update does not replace the runtime in the current process', async () => {
  const { rootDir, store } = await fixture()
  const current = await store.resolveStartupRuntime()
  const update = await fakeRuntime(path.join(rootDir, 'versions', '2.0.0'), '2.0.0')
  await store.setPending(update)
  assert.equal(current.version, '1.0.0')
  const pending = JSON.parse(await readFile(path.join(rootDir, 'pending.json'), 'utf8'))
  assert.equal(pending.version, '2.0.0')
})

test('an invalid pending pointer cannot displace a verified active version', async () => {
  const { rootDir, store } = await fixture()
  const active = await fakeRuntime(path.join(rootDir, 'versions', '1.5.0'), '1.5.0')
  await store.setPending(active)
  await store.resolveStartupRuntime()
  await writeFile(path.join(rootDir, 'pending.json'), JSON.stringify({
    version: '9.9.9',
    integrity: 'sha512-invalid',
  }))

  const runtime = await store.resolveStartupRuntime()
  assert.equal(runtime.version, '1.5.0')
  await assert.rejects(readFile(path.join(rootDir, 'pending.json')), /ENOENT/)
})

test('a runtime outside the managed versions directory cannot be staged', async () => {
  const { rootDir, store } = await fixture()
  const unmanaged = await fakeRuntime(path.join(rootDir, 'unmanaged', '2.0.0'), '2.0.0')
  await assert.rejects(store.setPending(unmanaged), /outside the managed versions directory/)
})
