'use strict'

const { constants } = require('node:fs')
const {
  access,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} = require('node:fs/promises')
const path = require('node:path')
const {
  INSTALLER_ID,
  PACKAGE_NAME,
  READY_MARKER,
  harnessBin,
} = require('./runtime-updater.cjs')

async function readJsonOptional(filename) {
  try {
    return JSON.parse(await readFile(filename, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return undefined
    return undefined
  }
}

async function writeJsonAtomic(filename, value) {
  await mkdir(path.dirname(filename), { recursive: true })
  const temporary = `${filename}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temporary, filename)
}

async function inspectRuntime(rootDir, expectedNodeVersion) {
  const marker = await readJsonOptional(path.join(rootDir, READY_MARKER))
  if (marker === undefined
    || marker.package !== PACKAGE_NAME
    || marker.installer !== INSTALLER_ID
    || marker.node !== expectedNodeVersion
    || typeof marker.version !== 'string'
    || typeof marker.integrity !== 'string') return undefined
  const binPath = harnessBin(rootDir)
  try {
    await access(binPath, constants.R_OK)
  } catch {
    return undefined
  }
  return {
    version: marker.version,
    integrity: marker.integrity,
    rootDir,
    binPath,
  }
}

class RuntimeStore {
  constructor(options) {
    this.rootDir = options.rootDir
    this.seedDir = options.seedDir
    this.nodeVersion = options.nodeVersion
    this.activePath = path.join(this.rootDir, 'active.json')
    this.pendingPath = path.join(this.rootDir, 'pending.json')
  }

  versionDir(version) {
    return path.join(this.rootDir, 'versions', version)
  }

  async runtimeForPointer(pointer) {
    if (pointer === undefined || typeof pointer.version !== 'string') return undefined
    const runtime = await inspectRuntime(this.versionDir(pointer.version), this.nodeVersion)
    if (runtime === undefined || runtime.integrity !== pointer.integrity) return undefined
    return runtime
  }

  async resolveStartupRuntime() {
    const pendingPointer = await readJsonOptional(this.pendingPath)
    const pending = await this.runtimeForPointer(pendingPointer)
    if (pending !== undefined) {
      await writeJsonAtomic(this.activePath, {
        version: pending.version,
        integrity: pending.integrity,
        activatedAt: new Date().toISOString(),
      })
      await rm(this.pendingPath, { force: true })
      return pending
    }
    if (pendingPointer !== undefined) await rm(this.pendingPath, { force: true })

    const active = await this.runtimeForPointer(await readJsonOptional(this.activePath))
    if (active !== undefined) return active

    const seed = await inspectRuntime(this.seedDir, this.nodeVersion)
    if (seed === undefined) {
      throw new Error('No verified bundled or installed DeepSeek Harness runtime is available.')
    }
    return seed
  }

  async setPending(runtime) {
    const versionsRoot = path.resolve(this.rootDir, 'versions')
    const relative = path.relative(versionsRoot, path.resolve(runtime.rootDir))
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Refusing to stage a Harness runtime outside the managed versions directory.')
    }
    const verified = await inspectRuntime(runtime.rootDir, this.nodeVersion)
    if (verified === undefined
      || verified.version !== runtime.version
      || verified.integrity !== runtime.integrity) {
      throw new Error('Refusing to stage an unverified Harness runtime for the next restart.')
    }
    await writeJsonAtomic(this.pendingPath, {
      version: verified.version,
      integrity: verified.integrity,
      preparedAt: new Date().toISOString(),
    })
  }
}

module.exports = {
  RuntimeStore,
  inspectRuntime,
  readJsonOptional,
  writeJsonAtomic,
}
