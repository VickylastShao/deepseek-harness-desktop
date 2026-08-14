'use strict'

const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const { mkdir, mkdtemp, readFile, writeFile } = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const yaml = require('js-yaml')
const { mergeMetadata, prepareMetadata } = require('../scripts/desktop-update-metadata.cjs')

test('prepared metadata describes the final installer bytes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-update-metadata-'))
  const release = path.join(root, 'release')
  await mkdir(release)
  await writeFile(path.join(release, 'latest.yml'), 'version: 0.1.9\npath: DeepSeek-0.1.9.exe\nsha512: old\n')
  const installer = Buffer.from('signed installer')
  await writeFile(path.join(release, 'DeepSeek-0.1.9.exe'), installer)

  const output = await prepareMetadata(release, 'win32-x64', path.join(root, 'metadata'))
  const value = yaml.load(await readFile(output, 'utf8'))

  assert.equal(value.path, 'DeepSeek-0.1.9.exe')
  assert.equal(value.files[0].size, installer.length)
  assert.equal(value.sha512, createHash('sha512').update(installer).digest('base64'))
})

test('macOS metadata combines Intel and Apple Silicon update artifacts', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-update-merge-'))
  const input = path.join(root, 'input')
  const output = path.join(root, 'output')
  await mkdir(input)
  const values = {
    'darwin-x64': 'desktop-mac-x64.zip',
    'darwin-arm64': 'desktop-mac-arm64.zip',
    'linux-x64': 'desktop-linux.AppImage',
    'win32-x64': 'desktop-win.exe',
  }
  for (const [target, url] of Object.entries(values)) {
    await writeFile(path.join(input, `${target}.yml`), yaml.dump({
      version: '0.1.9',
      files: [{ url, sha512: target, size: 1 }],
      path: url,
      sha512: target,
    }))
  }

  await mergeMetadata(input, output)

  const mac = yaml.load(await readFile(path.join(output, 'latest-mac.yml'), 'utf8'))
  assert.deepEqual(mac.files.map(file => file.url), [
    'desktop-mac-arm64.zip',
    'desktop-mac-x64.zip',
  ])
  assert.equal(yaml.load(await readFile(path.join(output, 'latest.yml'), 'utf8')).path, 'desktop-win.exe')
  assert.equal(yaml.load(await readFile(path.join(output, 'latest-linux.yml'), 'utf8')).path, 'desktop-linux.AppImage')
})

test('metadata merge refuses mixed application versions', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-update-mismatch-'))
  await mkdir(root, { recursive: true })
  for (const target of ['darwin-x64', 'darwin-arm64', 'linux-x64', 'win32-x64']) {
    await writeFile(path.join(root, `${target}.yml`), yaml.dump({
      version: target === 'win32-x64' ? '0.2.0' : '0.1.9',
      files: [{ url: target, sha512: target, size: 1 }],
    }))
  }

  await assert.rejects(() => mergeMetadata(root, path.join(root, 'output')), /versions do not match/u)
})
