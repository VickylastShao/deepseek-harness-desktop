'use strict'

const { createHash } = require('node:crypto')
const { createWriteStream } = require('node:fs')
const {
  access,
  mkdir,
  mkdtemp,
  rename,
  rm,
} = require('node:fs/promises')
const { Readable, Transform } = require('node:stream')
const { pipeline } = require('node:stream/promises')
const path = require('node:path')
const semver = require('semver')
const tar = require('tar')
const { inspectRuntime } = require('./runtime-store.cjs')
const { PACKAGE_NAME, smokeTest } = require('./runtime-updater.cjs')

const CHANNEL_SCHEMA = 1
const MAX_RUNTIME_BYTES = 2 * 1024 * 1024 * 1024

function platformKey(platform = process.platform, arch = process.arch) {
  if (!['win32', 'linux', 'darwin'].includes(platform)) {
    throw new Error(`Unsupported runtime update platform: ${platform}.`)
  }
  if (!['x64', 'arm64'].includes(arch)) {
    throw new Error(`Unsupported runtime update architecture: ${arch}.`)
  }
  return `${platform}-${arch}`
}

function requireHttpsUrl(value, label) {
  const url = new URL(value)
  if (url.protocol !== 'https:') throw new Error(`${label} must use HTTPS.`)
  return url.href
}

function validateChannel(value, options = {}) {
  if (value?.schemaVersion !== CHANNEL_SCHEMA
    || value?.package !== PACKAGE_NAME
    || !semver.valid(value?.version)
    || typeof value?.npmIntegrity !== 'string'
    || value.npmIntegrity.length === 0
    || value?.node !== options.nodeVersion) {
    throw new Error('Runtime update channel returned an incompatible manifest.')
  }
  const key = options.platformKey ?? platformKey()
  const artifact = value.artifacts?.[key]
  if (artifact === undefined
    || !/^[a-f0-9]{64}$/u.test(artifact.sha256)
    || !Number.isSafeInteger(artifact.size)
    || artifact.size <= 0
    || artifact.size > MAX_RUNTIME_BYTES) {
    throw new Error(`Runtime update channel has no valid artifact for ${key}.`)
  }
  return {
    version: value.version,
    npmIntegrity: value.npmIntegrity,
    artifact: {
      url: requireHttpsUrl(artifact.url, 'Runtime artifact URL'),
      sha256: artifact.sha256,
      size: artifact.size,
    },
  }
}

async function fetchChannel(options) {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 30_000)
  const signal = options.signal === undefined
    ? timeout
    : AbortSignal.any([options.signal, timeout])
  const response = await (options.fetchImpl ?? globalThis.fetch)(
    requireHttpsUrl(options.channelUrl, 'Runtime channel URL'),
    { headers: { accept: 'application/json' }, signal },
  )
  if (!response.ok) throw new Error(`Runtime update channel returned HTTP ${response.status}.`)
  return validateChannel(await response.json(), options)
}

async function downloadVerified(options) {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 15 * 60_000)
  const signal = options.signal === undefined
    ? timeout
    : AbortSignal.any([options.signal, timeout])
  const response = await (options.fetchImpl ?? globalThis.fetch)(options.url, {
    headers: { accept: 'application/gzip, application/octet-stream' },
    signal,
  })
  if (!response.ok || response.body === null) {
    throw new Error(`Runtime artifact download returned HTTP ${response.status}.`)
  }
  const advertised = Number.parseInt(response.headers.get('content-length') ?? '', 10)
  if (Number.isFinite(advertised) && advertised !== options.size) {
    throw new Error(`Runtime artifact size mismatch: expected ${options.size}, received ${advertised}.`)
  }

  const digest = createHash('sha256')
  let received = 0
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length
      if (received > options.size || received > MAX_RUNTIME_BYTES) {
        callback(new Error('Runtime artifact exceeded its declared size.'))
        return
      }
      digest.update(chunk)
      callback(null, chunk)
    },
  })
  await pipeline(
    Readable.fromWeb(response.body),
    meter,
    createWriteStream(options.destination, { flags: 'wx' }),
    { signal },
  )
  const actual = digest.digest('hex')
  if (received !== options.size || actual !== options.sha256) {
    throw new Error('Runtime artifact failed its SHA-256 or size verification.')
  }
}

class RuntimeBundleUpdater {
  constructor(options) {
    this.rootDir = options.rootDir
    this.runtimeExecutable = options.runtimeExecutable
    this.nodeVersion = options.nodeVersion
    this.channelUrl = options.channelUrl
    this.signal = options.signal
    this.fetchImpl = options.fetchImpl
    this.key = options.platformKey ?? platformKey()
    this.runSmokeTest = options.runSmokeTest ?? smokeTest
  }

  async prepareLatest(currentVersion, onStatus = () => {}) {
    onStatus({ phase: 'checking', message: '正在后台检查 DeepSeek Harness 更新……' })
    const channel = await fetchChannel({
      channelUrl: this.channelUrl,
      nodeVersion: this.nodeVersion,
      platformKey: this.key,
      signal: this.signal,
      fetchImpl: this.fetchImpl,
    })
    if (semver.valid(currentVersion) && semver.gte(currentVersion, channel.version)) {
      onStatus({ phase: 'current', message: `DeepSeek Harness ${currentVersion} 已是最新版本。` })
      return undefined
    }

    const versionsRoot = path.join(this.rootDir, 'versions')
    const versionDir = path.join(versionsRoot, channel.version)
    const cached = await inspectRuntime(versionDir, this.nodeVersion)
    if (cached !== undefined && cached.integrity === channel.npmIntegrity) return cached

    await mkdir(versionsRoot, { recursive: true })
    const stagingRoot = path.join(this.rootDir, 'staging')
    const downloadRoot = path.join(this.rootDir, 'downloads')
    await mkdir(stagingRoot, { recursive: true })
    await mkdir(downloadRoot, { recursive: true })
    const stageDir = await mkdtemp(path.join(stagingRoot, `${channel.version}-`))
    const archive = path.join(downloadRoot, `${channel.version}-${this.key}-${Date.now()}.tgz`)

    try {
      onStatus({ phase: 'downloading', message: `正在后台准备 DeepSeek Harness ${channel.version}……` })
      await downloadVerified({
        ...channel.artifact,
        destination: archive,
        signal: this.signal,
        fetchImpl: this.fetchImpl,
      })
      await tar.x({
        cwd: stageDir,
        file: archive,
        gzip: true,
        preservePaths: false,
        signal: this.signal,
      })
      const extracted = await inspectRuntime(stageDir, this.nodeVersion)
      if (extracted === undefined
        || extracted.version !== channel.version
        || extracted.integrity !== channel.npmIntegrity) {
        throw new Error('Downloaded Harness runtime marker did not match the channel metadata.')
      }
      await access(extracted.binPath)
      await this.runSmokeTest(this.runtimeExecutable, extracted.binPath, channel.version, {
        signal: this.signal,
      })

      const existing = await inspectRuntime(versionDir, this.nodeVersion)
      if (existing === undefined) {
        try {
          await rename(versionDir, path.join(stagingRoot, `${channel.version}-replaced-${Date.now()}`))
        } catch (error) {
          if (error.code !== 'ENOENT') throw error
        }
        await rename(stageDir, versionDir)
      } else {
        await rm(stageDir, { recursive: true, force: true })
      }
      const ready = await inspectRuntime(versionDir, this.nodeVersion)
      if (ready === undefined || ready.integrity !== channel.npmIntegrity) {
        throw new Error('Harness runtime failed its final staging check.')
      }
      onStatus({ phase: 'prepared', message: `DeepSeek Harness ${channel.version} 将在下次启动启用。` })
      return ready
    } finally {
      await rm(archive, { force: true })
      await rm(stageDir, { recursive: true, force: true })
    }
  }
}

module.exports = {
  CHANNEL_SCHEMA,
  MAX_RUNTIME_BYTES,
  RuntimeBundleUpdater,
  downloadVerified,
  fetchChannel,
  platformKey,
  requireHttpsUrl,
  validateChannel,
}
