'use strict'

const assert = require('node:assert/strict')
const { access, mkdir, mkdtemp, writeFile } = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { pruneNodePty } = require('../scripts/runtime-seed-prune.cjs')

async function nodePtyFixture() {
  const seedDir = await mkdtemp(path.join(os.tmpdir(), 'dsh-seed-prune-'))
  const root = path.join(seedDir, 'node_modules', 'node-pty')
  for (const key of ['win32-x64', 'win32-arm64', 'darwin-x64']) {
    const target = path.join(root, 'prebuilds', key)
    await mkdir(target, { recursive: true })
    await writeFile(path.join(target, 'pty.node'), key)
    await writeFile(path.join(target, 'pty.pdb'), `${key}-symbols`)
  }
  return { root, seedDir }
}

test('runtime pruning keeps only target node-pty prebuilds and removes debug symbols', async t => {
  const { root, seedDir } = await nodePtyFixture()
  t.after(() => require('node:fs/promises').rm(seedDir, { recursive: true, force: true }))

  const result = await pruneNodePty(seedDir, { platform: 'win32', arch: 'x64' })
  await access(path.join(root, 'prebuilds', 'win32-x64', 'pty.node'))
  await assert.rejects(access(path.join(root, 'prebuilds', 'win32-x64', 'pty.pdb')), /ENOENT/u)
  await assert.rejects(access(path.join(root, 'prebuilds', 'win32-arm64')), /ENOENT/u)
  await assert.rejects(access(path.join(root, 'prebuilds', 'darwin-x64')), /ENOENT/u)
  assert.equal(result.nativeSource, 'prebuilds/win32-x64')
  assert.equal(result.removedPrebuildDirectories, 2)
  assert.equal(result.removedDebugFiles, 1)
})

test('a source-built native module allows all foreign prebuilds to be removed', async t => {
  const { root, seedDir } = await nodePtyFixture()
  t.after(() => require('node:fs/promises').rm(seedDir, { recursive: true, force: true }))
  await mkdir(path.join(root, 'build', 'Release'), { recursive: true })
  await writeFile(path.join(root, 'build', 'Release', 'pty.node'), 'linux-native')

  const result = await pruneNodePty(seedDir, { platform: 'linux', arch: 'x64' })
  await access(path.join(root, 'build', 'Release', 'pty.node'))
  await assert.rejects(access(path.join(root, 'prebuilds')), /ENOENT/u)
  assert.equal(result.nativeSource, 'build/Release')
  assert.equal(result.removedPrebuildDirectories, 3)
})

test('pruning fails closed when no native node-pty binary matches the target', async t => {
  const { seedDir } = await nodePtyFixture()
  t.after(() => require('node:fs/promises').rm(seedDir, { recursive: true, force: true }))

  await assert.rejects(
    pruneNodePty(seedDir, { platform: 'linux', arch: 'x64' }),
    /no native binary for linux-x64/u,
  )
})
