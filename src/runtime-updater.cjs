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
const semver = require('semver')
const { terminateProcessTree } = require('./harness-process.cjs')

const PACKAGE_NAME = '@deepseek-ai/dsh'
const DEFAULT_REGISTRY = 'https://registry.npmjs.org/'
const READY_MARKER = '.runtime-ready.json'
const INSTALLER_ID = 'bundled-npm-v1'

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
  const signal = options.signal === undefined
    ? timeout
    : AbortSignal.any([options.signal, timeout])
  const response = await fetchImpl(endpoint, {
    headers: { accept: 'application/json' },
    signal,
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

async function readReadyRuntime(versionDir, manifest, nodeVersion) {
  try {
    const marker = JSON.parse(await readFile(path.join(versionDir, READY_MARKER), 'utf8'))
    const binPath = harnessBin(versionDir)
    await access(binPath, constants.R_OK)
    if (marker.package !== PACKAGE_NAME
      || marker.version !== manifest.version
      || marker.integrity !== manifest.dist.integrity
      || marker.node !== nodeVersion
      || marker.installer !== INSTALLER_ID) return undefined
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

function cleanNodeEnvironment(extra = {}) {
  const env = {
    ...process.env,
    ...extra,
    npm_config_proxy: '',
    npm_config_https_proxy: '',
  }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_NO_ATTACH_CONSOLE
  for (const key of [
    'http_proxy', 'https_proxy', 'all_proxy',
    'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY',
  ]) delete env[key]
  return env
}

function runtimePathEnvironment(runtimeExecutable) {
  const currentKey = Object.keys(process.env).find(key => key.toLowerCase() === 'path') ?? 'PATH'
  return {
    [currentKey]: `${path.dirname(runtimeExecutable)}${path.delimiter}${process.env[currentKey] ?? ''}`,
  }
}

function runCommand(executable, args, options = {}) {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(options.signal.reason ?? new Error('Command aborted.'))
      return
    }
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: cleanNodeEnvironment(options.env),
      windowsHide: true,
      detached: options.detached ?? (process.platform !== 'win32'),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      void terminateProcessTree(child).finally(() => {
        reject(new Error(`${options.label ?? 'Command'} timed out.`))
      })
    }, options.timeoutMs ?? 120_000)
    const abort = () => {
      void terminateProcessTree(child).finally(() => {
        reject(options.signal.reason ?? new Error('Command aborted.'))
      })
    }
    options.signal?.addEventListener('abort', abort, { once: true })
    const cleanup = () => options.signal?.removeEventListener('abort', abort)
    child.stdout.on('data', chunk => { stdout = (stdout + chunk.toString()).slice(-24_000) })
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-24_000) })
    child.once('error', error => {
      clearTimeout(timer)
      cleanup()
      reject(error)
    })
    child.once('exit', code => {
      clearTimeout(timer)
      cleanup()
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(`${options.label ?? 'Command'} failed (exit ${code ?? 'unknown'}): ${stderr || stdout}`))
    })
  })
}

async function installWithNpm(runtimeExecutable, npmCliPath, cacheDir, stageDir, manifest, registry, signal) {
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

  const common = {
    cwd: stageDir,
    env: runtimePathEnvironment(runtimeExecutable),
    timeoutMs: 20 * 60_000,
    detached: process.platform !== 'win32',
    signal,
  }
  await runCommand(runtimeExecutable, [
    npmCliPath,
    'install',
    '--no-audit',
    '--no-fund',
    '--ignore-scripts=false',
    '--package-lock=true',
    `--registry=${registry}`,
    `--cache=${cacheDir}`,
  ], {
    ...common,
    label: `Harness ${manifest.version} npm install`,
  })

  const pendingResult = await runCommand(runtimeExecutable, [
    npmCliPath,
    'install-scripts',
    'ls',
    '--json',
  ], {
    ...common,
    label: 'Harness install-script inventory',
  })
  const inventory = JSON.parse(pendingResult.stdout)
  const pending = Array.isArray(inventory.allowScripts) ? inventory.allowScripts : []
  if (pending.length === 0) return

  await runCommand(runtimeExecutable, [
    npmCliPath,
    'install-scripts',
    'approve',
    '--all',
  ], {
    ...common,
    label: 'Harness install-script approval',
  })
  await runCommand(runtimeExecutable, [
    npmCliPath,
    'rebuild',
  ], {
    ...common,
    label: 'Harness native dependency build',
  })
}

async function smokeTest(runtimeExecutable, binPath, expectedVersion, options = {}) {
  const rootDir = path.resolve(binPath, '..', '..', '..', '..', '..')
  const versionResult = await runCommand(runtimeExecutable, [binPath, '--version'], {
    cwd: rootDir,
    timeoutMs: options.timeoutMs ?? 20_000,
    signal: options.signal,
    label: 'Harness version self-test',
  })
  if (versionResult.stdout.trim() !== expectedVersion) {
    throw new Error(`Harness version self-test returned ${JSON.stringify(versionResult.stdout.trim())}.`)
  }
  await runCommand(runtimeExecutable, ['-e', "require('node-pty')"], {
    cwd: rootDir,
    timeoutMs: options.timeoutMs ?? 20_000,
    signal: options.signal,
    label: 'Harness native-module self-test',
  })
}

class RuntimeUpdater {
  constructor(options) {
    this.rootDir = options.rootDir
    this.runtimeExecutable = options.runtimeExecutable
    this.npmCliPath = options.npmCliPath
    this.registry = normalizedRegistry(options.registry)
    this.signal = options.signal
    this.fetchManifest = options.fetchManifest ?? (() => fetchLatestManifest({
      registry: this.registry,
      signal: this.signal,
    }))
    this.installVersion = options.installVersion ?? ((stageDir, manifest, registry) => {
      if (this.npmCliPath === undefined) throw new Error('Bundled npm CLI path is required.')
      return installWithNpm(
        this.runtimeExecutable,
        this.npmCliPath,
        path.join(this.rootDir, 'npm-cache'),
        stageDir,
        manifest,
        registry,
        this.signal,
      )
    })
    this.runSmokeTest = options.runSmokeTest ?? smokeTest
    this.nodeVersion = options.nodeVersion ?? process.versions.node
  }

  async prepareLatest(currentVersion, onStatus = () => {}) {
    onStatus({ phase: 'checking', message: '正在检查 DeepSeek Harness 最新版本……' })
    const manifest = await this.fetchManifest()
    assertNodeCompatibility(manifest, this.nodeVersion)
    if (manifest.version === currentVersion) {
      onStatus({ phase: 'current', message: `DeepSeek Harness ${currentVersion} 已是最新版本。` })
      return undefined
    }

    const versionsRoot = path.join(this.rootDir, 'versions')
    const versionDir = path.join(versionsRoot, manifest.version)
    const ready = await readReadyRuntime(versionDir, manifest, this.nodeVersion)
    if (ready !== undefined) {
      onStatus({ phase: 'prepared', message: `DeepSeek Harness ${manifest.version} 已准备好，将在下次启动启用。` })
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
      await this.runSmokeTest(this.runtimeExecutable, binPath, manifest.version, { signal: this.signal })
      await writeFile(path.join(stageDir, READY_MARKER), `${JSON.stringify({
        package: PACKAGE_NAME,
        version: manifest.version,
        integrity: manifest.dist.integrity,
        installer: INSTALLER_ID,
        verifiedAt: new Date().toISOString(),
        node: this.nodeVersion,
      }, null, 2)}\n`, 'utf8')

      const stale = await readReadyRuntime(versionDir, manifest, this.nodeVersion)
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

      const installed = await readReadyRuntime(versionDir, manifest, this.nodeVersion)
      if (installed === undefined) throw new Error('Harness runtime did not pass its final activation check.')
      onStatus({ phase: 'prepared', message: `DeepSeek Harness ${manifest.version} 已下载并验证，将在下次启动启用。` })
      return installed
    } catch (error) {
      await rm(stageDir, { recursive: true, force: true })
      throw error
    }
  }
}

module.exports = {
  DEFAULT_REGISTRY,
  INSTALLER_ID,
  PACKAGE_NAME,
  READY_MARKER,
  RuntimeUpdater,
  assertNodeCompatibility,
  fetchLatestManifest,
  harnessBin,
  installWithNpm,
  normalizedRegistry,
  readReadyRuntime,
  runtimePathEnvironment,
  runCommand,
  smokeTest,
}
