'use strict'

const { createHash } = require('node:crypto')
const { mkdir, readFile, stat, writeFile } = require('node:fs/promises')
const path = require('node:path')
const yaml = require('js-yaml')

const TARGETS = Object.freeze({
  'darwin-arm64': { metadata: 'latest-mac.yml', extension: '.zip' },
  'darwin-x64': { metadata: 'latest-mac.yml', extension: '.zip' },
  'linux-x64': { metadata: 'latest-linux.yml', extension: '.AppImage' },
  'win32-x64': { metadata: 'latest.yml', extension: '.exe' },
})

async function fileInfo(filename) {
  const body = await readFile(filename)
  return {
    url: path.basename(filename),
    sha512: createHash('sha512').update(body).digest('base64'),
    size: body.length,
  }
}

async function prepareMetadata(releaseDir, targetId, outputDir) {
  const target = TARGETS[targetId]
  if (target === undefined) throw new Error(`Unsupported desktop update target: ${targetId}.`)
  const source = path.join(releaseDir, target.metadata)
  const metadata = yaml.load(await readFile(source, 'utf8'))
  if (typeof metadata?.version !== 'string') throw new Error(`${source} has no update version.`)
  const declaredPath = metadata.path ?? metadata.files?.[0]?.url
  if (typeof declaredPath !== 'string'
    || path.basename(declaredPath) !== declaredPath
    || path.extname(declaredPath) !== target.extension) {
    throw new Error(`${source} does not declare a valid ${target.extension} update artifact.`)
  }
  const artifact = await fileInfo(path.join(releaseDir, declaredPath))
  const normalized = {
    ...metadata,
    files: [artifact],
    path: artifact.url,
    sha512: artifact.sha512,
  }
  await mkdir(outputDir, { recursive: true })
  const output = path.join(outputDir, `${targetId}.yml`)
  await writeFile(output, yaml.dump(normalized, { lineWidth: -1, noRefs: true }), 'utf8')
  return output
}

async function mergeMetadata(inputDir, outputDir) {
  const entries = {}
  for (const targetId of Object.keys(TARGETS)) {
    const filename = path.join(inputDir, `${targetId}.yml`)
    try {
      if (!(await stat(filename)).isFile()) throw new Error('not a file')
    } catch {
      throw new Error(`Desktop update metadata is missing ${targetId}.yml.`)
    }
    entries[targetId] = yaml.load(await readFile(filename, 'utf8'))
  }
  const versions = new Set(Object.values(entries).map(entry => entry.version))
  if (versions.size !== 1) throw new Error('Desktop update metadata versions do not match.')

  const mac = {
    ...entries['darwin-x64'],
    files: [
      ...entries['darwin-x64'].files,
      ...entries['darwin-arm64'].files,
    ].sort((a, b) => a.url.localeCompare(b.url)),
  }
  await mkdir(outputDir, { recursive: true })
  await Promise.all([
    writeFile(path.join(outputDir, 'latest.yml'), yaml.dump(entries['win32-x64'], { lineWidth: -1, noRefs: true })),
    writeFile(path.join(outputDir, 'latest-linux.yml'), yaml.dump(entries['linux-x64'], { lineWidth: -1, noRefs: true })),
    writeFile(path.join(outputDir, 'latest-mac.yml'), yaml.dump(mac, { lineWidth: -1, noRefs: true })),
  ])
}

async function main() {
  const command = process.argv[2]
  if (command === 'prepare') {
    const output = await prepareMetadata(
      path.resolve(process.argv[3] ?? 'release'),
      process.argv[4],
      path.resolve(process.argv[5] ?? 'update-metadata'),
    )
    console.log(`Prepared ${output}`)
    return
  }
  if (command === 'merge') {
    await mergeMetadata(
      path.resolve(process.argv[3] ?? 'update-metadata'),
      path.resolve(process.argv[4] ?? 'release'),
    )
    console.log('Merged desktop update metadata.')
    return
  }
  throw new Error('Usage: desktop-update-metadata.cjs prepare|merge ...')
}

if (require.main === module) {
  main().catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}

module.exports = { fileInfo, mergeMetadata, prepareMetadata, TARGETS }
