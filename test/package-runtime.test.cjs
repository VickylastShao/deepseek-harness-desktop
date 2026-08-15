'use strict'

const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const { mkdir, mkdtemp, readFile, stat, writeFile } = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { promisify } = require('node:util')
const { execFile } = require('node:child_process')
const test = require('node:test')
const yaml = require('js-yaml')
const {
  INSTALLER_ID,
  PACKAGE_NAME,
  READY_MARKER,
} = require('../src/runtime-updater.cjs')

const execFileAsync = promisify(execFile)
const projectRoot = path.resolve(__dirname, '..')

test('runtime packaging stages one fixed-name archive and verified manifest for the installer', async t => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'dsh-package-runtime-'))
  t.after(() => require('node:fs/promises').rm(base, { recursive: true, force: true }))
  const seedDir = path.join(base, 'seed')
  const packageDir = path.join(seedDir, 'node_modules', '@deepseek-ai', 'dsh', 'lib')
  await mkdir(packageDir, { recursive: true })
  await writeFile(path.join(packageDir, 'bin.js'), '#!/usr/bin/env node\n')
  const nodeVersion = JSON.parse(await readFile(
    path.join(projectRoot, 'node_modules', 'node', 'package.json'),
    'utf8',
  )).version
  await writeFile(path.join(seedDir, READY_MARKER), `${JSON.stringify({
    package: PACKAGE_NAME,
    version: '1.2.3',
    integrity: 'sha512-runtime',
    installer: INSTALLER_ID,
    node: nodeVersion,
  })}\n`)
  const releaseDir = path.join(base, 'release')
  const bundleDir = path.join(base, 'bundle')

  await execFileAsync(process.execPath, ['scripts/package-runtime.cjs'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      RUNTIME_SEED_DIR: seedDir,
      RUNTIME_RELEASE_DIR: releaseDir,
      RUNTIME_BUNDLE_DIR: bundleDir,
    },
  })

  const archive = await readFile(path.join(bundleDir, 'runtime.tgz'))
  const manifest = JSON.parse(await readFile(path.join(bundleDir, 'runtime.json'), 'utf8'))
  assert.equal(manifest.package, PACKAGE_NAME)
  assert.equal(manifest.filename, 'runtime.tgz')
  assert.equal(manifest.size, (await stat(path.join(bundleDir, 'runtime.tgz'))).size)
  assert.equal(manifest.sha256, createHash('sha256').update(archive).digest('hex'))
  assert.equal(manifest.node, nodeVersion)
  assert.equal(manifest.key, `${process.platform}-${process.arch}`)

  const builder = yaml.load(await readFile(path.join(projectRoot, 'electron-builder.yml'), 'utf8'))
  const packagedRuntime = builder.extraResources.find(entry => entry.to === 'runtime-bundle')
  assert.equal(packagedRuntime.from, 'build/packaged-runtime')
  assert.deepEqual(packagedRuntime.filter, ['runtime.tgz', 'runtime.json'])
  assert.equal(builder.extraResources.some(entry => entry.to === '.'), false)
})
