'use strict'

const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const { mkdir, mkdtemp, readFile, writeFile } = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const tar = require('tar')
const {
  RuntimeBundleUpdater,
  platformKey,
  validateChannel,
} = require('../src/runtime-bundle-updater.cjs')
const {
  INSTALLER_ID,
  PACKAGE_NAME,
  READY_MARKER,
} = require('../src/runtime-updater.cjs')

const NODE_VERSION = '24.18.1'
const KEY = 'linux-x64'

function channel(artifact, version = '1.2.3') {
  return {
    schemaVersion: 1,
    package: PACKAGE_NAME,
    version,
    npmIntegrity: `sha512-${version}`,
    node: NODE_VERSION,
    artifacts: { [KEY]: artifact },
  }
}

async function runtimeArchive(base, version) {
  const source = path.join(base, 'source')
  const packageDir = path.join(source, 'node_modules', '@deepseek-ai', 'dsh', 'lib')
  await mkdir(packageDir, { recursive: true })
  await writeFile(path.join(packageDir, 'bin.js'), '#!/usr/bin/env node\n')
  await writeFile(path.join(source, READY_MARKER), JSON.stringify({
    package: PACKAGE_NAME,
    version,
    integrity: `sha512-${version}`,
    installer: INSTALLER_ID,
    node: NODE_VERSION,
  }))
  const archive = path.join(base, 'runtime.tgz')
  await tar.c({ cwd: source, file: archive, gzip: true }, ['.'])
  const body = await readFile(archive)
  return {
    body,
    artifact: {
      url: 'https://downloads.example/runtime.tgz',
      sha256: createHash('sha256').update(body).digest('hex'),
      size: body.length,
    },
  }
}

test('platform key is explicit and rejects unsupported targets', () => {
  assert.equal(platformKey('linux', 'x64'), KEY)
  assert.throws(() => platformKey('freebsd', 'x64'), /Unsupported/)
  assert.throws(() => platformKey('linux', 'ia32'), /Unsupported/)
})

test('channel validation requires HTTPS, matching Node, size, and SHA-256', () => {
  const artifact = { url: 'https://example/runtime.tgz', sha256: 'a'.repeat(64), size: 42 }
  assert.equal(validateChannel(channel(artifact), {
    nodeVersion: NODE_VERSION,
    platformKey: KEY,
  }).version, '1.2.3')
  assert.throws(() => validateChannel(channel({ ...artifact, url: 'http://example/runtime.tgz' }), {
    nodeVersion: NODE_VERSION,
    platformKey: KEY,
  }), /HTTPS/)
  assert.throws(() => validateChannel({ ...channel(artifact), node: '25.0.0' }, {
    nodeVersion: NODE_VERSION,
    platformKey: KEY,
  }), /incompatible/)
})

test('a platform runtime bundle is verified and staged without npm installation', async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'dsh-bundle-update-'))
  const packed = await runtimeArchive(base, '2.0.0')
  const value = channel(packed.artifact, '2.0.0')
  let smokeBin
  const fetchImpl = async url => {
    if (String(url).includes('channel')) return Response.json(value)
    return new Response(packed.body, {
      headers: { 'content-length': String(packed.body.length) },
    })
  }
  const updater = new RuntimeBundleUpdater({
    rootDir: path.join(base, 'managed'),
    runtimeExecutable: '/fake/node',
    nodeVersion: NODE_VERSION,
    channelUrl: 'https://updates.example/channel.json',
    platformKey: KEY,
    fetchImpl,
    runSmokeTest: async (_node, binPath) => { smokeBin = binPath },
  })
  const result = await updater.prepareLatest('1.9.0')
  assert.equal(result.version, '2.0.0')
  assert.match(smokeBin, /staging/)
  assert.match(result.rootDir, /versions[/\\]2\.0\.0$/u)
})

test('an equal current version checks metadata but skips the bundle download', async () => {
  const artifact = { url: 'https://example/runtime.tgz', sha256: 'a'.repeat(64), size: 42 }
  let requests = 0
  const updater = new RuntimeBundleUpdater({
    rootDir: '/unused',
    runtimeExecutable: '/fake/node',
    nodeVersion: NODE_VERSION,
    channelUrl: 'https://updates.example/channel.json',
    platformKey: KEY,
    fetchImpl: async () => {
      requests += 1
      return Response.json(channel(artifact))
    },
  })
  assert.equal(await updater.prepareLatest('1.2.3'), undefined)
  assert.equal(requests, 1)
})
