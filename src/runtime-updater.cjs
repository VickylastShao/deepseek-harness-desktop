'use strict'

const { spawn } = require('node:child_process')
const { constants } = require('node:fs')
const {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} = require('node:fs/promises')
const path = require('node:path')
const Arborist = require('@npmcli/arborist')
const semver = require('semver')

const PACKAGE_NAME = '@deepseek-ai/dsh'
const DEFAULT_REGISTRY = 'https://registry.npmjs.org/'
const READY_MARKER = '.runtime-ready.json'

function normalizedRegistry(value = DEFAULT_REGISTRY) {
  const registry = new URL(value)
  if (registry.protocol !== 'https:') {
    throw new Error(`Harness registry must use HTTPS: ${registry.href}`)
  }
  if (!registry.pathname.endsWith('/')) registry.pathname += '/'
  return registry.href
}

async function fetchLatestManifest(options = {}) {
  const registry = normalizedRegistry(options.registry)
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') throw new Error('This runtime does not provide fetch().')

  const endpoint = new URL(`${PACKAGE_NAME.replace('/', '%2F')}/latest`, registry)
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 30_000)
  const response = await fetchImpl(endpoint, {
    headers: { accept: 'application/json' },
    signal: timeout,
  })
  if (!response.ok) {
    throw new Error(`Harness update check failed: registry returned HTTP ${response.status}.`)
  }

  const manifest = await response.json()
  if (manifest?.name !== PACKAGE_NAME || !semver.valid(manifest?.version)) {
    throw new Error('Harness update check returned an invalid package manifest.')
  }
  if (typeof manifest?.dist?.integrity !== 'string' || manifest.dist.integrity.length === 0) {
    throw new Error('Harness update manifest has no package integrity value.')
  }
  return manifest
}

function assertNodeCompatibility(manifest, nodeVersion = process.versions.node) {
  const range = manifest?.engines?.node
  if (typeof range === 'string' && !semver.satisfies(nodeVersion, range)) {
    throw new Error(
      `DeepSeek Harness ${manifest.version} requires Node ${range}, but this desktop build provides Node ${nodeVersion}.`,
    )
  }
}

function harnessBin(rootDir) {
  return path.join(rootDir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
}

async function readReadyRuntime(versionDir, manifest) {
  try {
    const marker = JSON.parse(await readFile(path.join(versionDir, READY_MARKER), 'utf8'))
    const binPath = harnessBin(versionDir)
    await access(binPath, constants.R_OK)
    if (marker.package !== PACKAGE_NAME
      || marker.version !== manifest.version
      || marker.integrity !== manifest.dist.integrity) return undefined
    return {
      version: marker.version,
      integrity: marker.integrity,
      rootDir: versionDir,
      binPath,
    }
  } catch {
    return undefined
  }
}

async function installWithArborist(stageDir, manifest, registry) {
  const packageJson = {
    name: 'deepseek-harness-desktop-runtime',
    private: true,
    dependencies: { [PACKAGE_NAME]: manifest.version },
  }
  await writeFile(
    path.join(stageDir, 'package.json'),
    `${JSON.stringify(packageJson, null, 2)}\n`,
    'utf8',
  )

  const arborist = new Arborist({
    path: stageDir,
    registry,
    audit: false,
    fund: false,
    packageLock: true,
    proxy: null,
    httpsProxy: null,
  })
  await arborist.reify()
}

function smokeTest(runtimeExecutable, binPath, expectedVersion, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(runtimeExecutable, [binPath, '--version'], {
      cwd: path.dirname(binPath),
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        ELECTRON_NO_ATTACH_CONSOLE: '1',
      },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Harness version self-test timed out.'))
    }, options.timeoutMs ?? 20_000)

    child.stdout.on('data', chunk => { stdout += chunk.toString() })
    child.stderr.on('data', chunk => { stderr += chunk.toString() })
    child.once('error', error => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('exit', code => {
      clearTimeout(timer)
      if (code === 0 && stdout.trim() === expectedVersion) {
        resolve()
      } else {
        reject(new Error(`Harness version self-test failed (exit ${code ?? 'unknown'}): ${stderr || stdout}`))
      }
    })
  })
}

class RuntimeUpdater {
  constructor(options) {
    this.rootDir = options.rootDir
    this.runtimeExecutable = options.runtimeExecutable
    this.registry = normalizedRegistry(options.registry)
    this.fetchManifest = options.fetchManifest ?? (() => fetchLatestManifest({ registry: this.registry }))
    this.installVersion = options.installVersion ?? installWithArborist
    this.runSmokeTest = options.runSmokeTest ?? smokeTest
    this.nodeVersion = options.nodeVersion ?? process.versions.node
  }

  async ensureLatest(onStatus = () => {}) {
    onStatus({ phase: 'checking', message: '正在检查 DeepSeek Harness 最新版本……' })
    const manifest = await this.fetchManifest()
    assertNodeCompatibility(manifest, this.nodeVersion)

    const versionsRoot = path.join(this.rootDir, 'versions')
    const versionDir = path.join(versionsRoot, manifest.version)
    const ready = await readReadyRuntime(versionDir, manifest)
    if (ready !== undefined) {
      onStatus({ phase: 'ready', message: `已确认 DeepSeek Harness ${manifest.version} 为最新版本。` })
      return ready
    }

    onStatus({ phase: 'installing', message: `正在安装 DeepSeek Harness ${manifest.version}……` })
    const stagingRoot = path.join(this.rootDir, 'staging')
    await mkdir(stagingRoot, { recursive: true })
    await mkdir(versionsRoot, { recursive: true })
    const stageDir = await mkdtemp(path.join(stagingRoot, `${manifest.version}-`))

    try {
      await this.installVersion(stageDir, manifest, this.registry)
      const installedManifest = JSON.parse(await readFile(
        path.join(stageDir, 'node_modules', '@deepseek-ai', 'dsh', 'package.json'),
        'utf8',
      ))
      if (installedManifest.name !== PACKAGE_NAME || installedManifest.version !== manifest.version) {
        throw new Error('Installed Harness package does not match the registry manifest.')
      }

      const binPath = harnessBin(stageDir)
      await access(binPath, constants.R_OK)
      onStatus({ phase: 'verifying', message: `正在验证 DeepSeek Harness ${manifest.version}……` })
      await this.runSmokeTest(this.runtimeExecutable, binPath, manifest.version)
      await writeFile(path.join(stageDir, READY_MARKER), `${JSON.stringify({
        package: PACKAGE_NAME,
        version: manifest.version,
        integrity: manifest.dist.integrity,
        verifiedAt: new Date().toISOString(),
        node: this.nodeVersion,
      }, null, 2)}\n`, 'utf8')

      const stale = await readReadyRuntime(versionDir, manifest)
      if (stale === undefined) {
        try {
          await rename(versionDir, path.join(stagingRoot, `${manifest.version}-replaced-${Date.now()}`))
        } catch (error) {
          if (error.code !== 'ENOENT') throw error
        }
        await rename(stageDir, versionDir)
      } else {
        await rm(stageDir, { recursive: true, force: true })
      }

      const installed = await readReadyRuntime(versionDir, manifest)
      if (installed === undefined) throw new Error('Harness runtime did not pass its final activation check.')
      onStatus({ phase: 'ready', message: `DeepSeek Harness ${manifest.version} 已更新并验证。` })
      return installed
    } catch (error) {
      await rm(stageDir, { recursive: true, force: true })
      throw error
    }
  }
}

module.exports = {
  DEFAULT_REGISTRY,
  PACKAGE_NAME,
  READY_MARKER,
  RuntimeUpdater,
  assertNodeCompatibility,
  fetchLatestManifest,
  harnessBin,
  normalizedRegistry,
  readReadyRuntime,
  smokeTest,
}
