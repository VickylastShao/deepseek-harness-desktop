'use strict'

const { access, readdir, rm } = require('node:fs/promises')
const path = require('node:path')

async function exists(filename) {
  try {
    await access(filename)
    return true
  } catch {
    return false
  }
}

async function removeDebugSymbols(rootDir) {
  let removed = 0
  let entries
  try {
    entries = await readdir(rootDir, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return 0
    throw error
  }
  for (const entry of entries) {
    const filename = path.join(rootDir, entry.name)
    if (entry.isDirectory()) {
      removed += await removeDebugSymbols(filename)
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.pdb') {
      await rm(filename, { force: true })
      removed += 1
    }
  }
  return removed
}

async function pruneNodePty(seedDir, options = {}) {
  const platform = options.platform ?? process.platform
  const arch = options.arch ?? process.arch
  const key = `${platform}-${arch}`
  const nodePtyRoot = path.join(seedDir, 'node_modules', 'node-pty')
  const prebuildsRoot = path.join(nodePtyRoot, 'prebuilds')
  const targetPrebuild = path.join(prebuildsRoot, key)
  const releaseBinary = path.join(nodePtyRoot, 'build', 'Release', 'pty.node')
  const hasReleaseBinary = await exists(releaseBinary)
  const hasTargetPrebuild = await exists(path.join(targetPrebuild, 'pty.node'))
  if (!hasReleaseBinary && !hasTargetPrebuild) {
    throw new Error(`Refusing to prune node-pty: no native binary for ${key}.`)
  }

  let removedPrebuildDirectories = 0
  let prebuildEntries = []
  try {
    prebuildEntries = await readdir(prebuildsRoot, { withFileTypes: true })
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  for (const entry of prebuildEntries) {
    if (!entry.isDirectory() || (hasTargetPrebuild && entry.name === key)) continue
    await rm(path.join(prebuildsRoot, entry.name), { recursive: true, force: true })
    removedPrebuildDirectories += 1
  }
  if (!hasTargetPrebuild) await rm(prebuildsRoot, { recursive: true, force: true })

  const removedDebugFiles = await removeDebugSymbols(nodePtyRoot)
  return {
    key,
    nativeSource: hasReleaseBinary ? 'build/Release' : `prebuilds/${key}`,
    removedPrebuildDirectories,
    removedDebugFiles,
  }
}

module.exports = { pruneNodePty, removeDebugSymbols }
