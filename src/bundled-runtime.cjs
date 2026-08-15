'use strict'

const { createHash } = require('node:crypto')
const { createReadStream } = require('node:fs')
const {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
} = require('node:fs/promises')
const path = require('node:path')
const { setTimeout: wait } = require('node:timers/promises')
const semver = require('semver')
const tar = require('tar')
const {
  MAX_RUNTIME_BYTES,
  platformKey,
} = require('./runtime-bundle-updater.cjs')
const { inspectRuntime } = require('./runtime-store.cjs')
const { PACKAGE_NAME, smokeTest } = require('./runtime-updater.cjs')

const BUNDLED_RUNTIME_SCHEMA = 1
const BUNDLED_RUNTIME_ARCHIVE = 'runtime.tgz'
const BUNDLED_RUNTIME_MANIFEST = 'runtime.json'
const TRANSIENT_WINDOWS_RENAME_ERRORS = new Set(['EACCES', 'EBUSY', 'EPERM'])

async function renameWithRetry(source, destination, options = {}) {
  const platform = options.platform ?? process.platform
  const renameImpl = options.renameImpl ?? rename
  const waitImpl = options.waitImpl ?? wait
  const maxAttempts = options.maxAttempts ?? 12
  const retryDelayMs = options.retryDelayMs ?? 100
  for (let attempt = 1; ; attempt += 1) {
    try {
      await renameImpl(source, destination)
      return
    } catch (error) {
      if (platform !== 'win32'
        || !TRANSIENT_WINDOWS_RENAME_ERRORS.has(error.code)
        || attempt >= maxAttempts) throw error
      await waitImpl(retryDelayMs * attempt)
    }
  }
}

function validateBundledManifest(value, options = {}) {
  const expectedKey = options.platformKey ?? platformKey()
  if (value?.schemaVersion !== BUNDLED_RUNTIME_SCHEMA
    || value?.package !== PACKAGE_NAME
    || !semver.valid(value?.version)
    || typeof value?.npmIntegrity !== 'string'
    || value.npmIntegrity.length === 0
    || value?.node !== options.nodeVersion
    || value?.key !== expectedKey
    || value?.filename !== BUNDLED_RUNTIME_ARCHIVE
    || !/^[a-f0-9]{64}$/u.test(value?.sha256)
    || !Number.isSafeInteger(value?.size)
    || value.size <= 0
    || value.size > MAX_RUNTIME_BYTES) {
    throw new Error('Bundled runtime manifest is incompatible with this application build.')
  }
  return value
}

async function sha256File(filename) {
  const digest = createHash('sha256')
  for await (const chunk of createReadStream(filename)) digest.update(chunk)
  return digest.digest('hex')
}

async function verifyArchive(filename, manifest) {
  const details = await stat(filename)
  if (!details.isFile()
    || details.size !== manifest.size
    || await sha256File(filename) !== manifest.sha256) {
    throw new Error('Bundled runtime failed its SHA-256 or size verification.')
  }
}

async function prepareBundledRuntime(options, onStatus = () => {}) {
  const manifest = validateBundledManifest(JSON.parse(await readFile(
    path.join(options.bundleDir, BUNDLED_RUNTIME_MANIFEST),
    'utf8',
  )), {
    nodeVersion: options.nodeVersion,
    platformKey: options.platformKey,
  })
  const bundledRoot = path.join(options.rootDir, 'bundled')
  const versionDir = path.join(bundledRoot, manifest.version)
  const cached = await inspectRuntime(versionDir, options.nodeVersion)
  if (cached !== undefined && cached.integrity === manifest.npmIntegrity) return cached

  const archive = path.join(options.bundleDir, BUNDLED_RUNTIME_ARCHIVE)
  onStatus({ phase: 'verifying', message: '正在校验内置 DeepSeek Harness 运行时……' })
  await verifyArchive(archive, manifest)

  const stagingRoot = path.join(options.rootDir, 'staging')
  await mkdir(stagingRoot, { recursive: true })
  await mkdir(bundledRoot, { recursive: true })
  const stageDir = await mkdtemp(path.join(stagingRoot, `bundled-${manifest.version}-`))
  let displaced

  try {
    onStatus({ phase: 'extracting', message: '首次启动，正在解压内置 DeepSeek Harness 运行时……' })
    await tar.x({
      cwd: stageDir,
      file: archive,
      gzip: true,
      preservePaths: false,
    })
    const extracted = await inspectRuntime(stageDir, options.nodeVersion)
    if (extracted === undefined
      || extracted.version !== manifest.version
      || extracted.integrity !== manifest.npmIntegrity) {
      throw new Error('Bundled runtime marker does not match its verified manifest.')
    }

    onStatus({ phase: 'testing', message: '正在验证内置 DeepSeek Harness 原生运行环境……' })
    await (options.runSmokeTest ?? smokeTest)(
      options.runtimeExecutable,
      extracted.binPath,
      manifest.version,
    )

    try {
      displaced = path.join(stagingRoot, `bundled-${manifest.version}-replaced-${Date.now()}`)
      await renameWithRetry(versionDir, displaced)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      displaced = undefined
    }
    await renameWithRetry(stageDir, versionDir)
    if (displaced !== undefined) await rm(displaced, { recursive: true, force: true })

    const ready = await inspectRuntime(versionDir, options.nodeVersion)
    if (ready === undefined || ready.integrity !== manifest.npmIntegrity) {
      throw new Error('Bundled runtime failed its final activation check.')
    }
    onStatus({ phase: 'ready', message: `内置 DeepSeek Harness ${ready.version} 已准备完成。` })
    return ready
  } finally {
    await rm(stageDir, { recursive: true, force: true })
  }
}

module.exports = {
  BUNDLED_RUNTIME_ARCHIVE,
  BUNDLED_RUNTIME_MANIFEST,
  BUNDLED_RUNTIME_SCHEMA,
  prepareBundledRuntime,
  renameWithRetry,
  sha256File,
  validateBundledManifest,
  verifyArchive,
}
