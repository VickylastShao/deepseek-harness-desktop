'use strict'

const { readdir, readFile, writeFile } = require('node:fs/promises')
const path = require('node:path')
const { PACKAGE_NAME } = require('../src/runtime-updater.cjs')

async function main() {
  const inputDir = path.resolve(process.argv[2] ?? 'runtime-release')
  const output = path.resolve(process.argv[3] ?? path.join(inputDir, 'runtime-channel.json'))
  const baseUrl = new URL(process.env.RUNTIME_RELEASE_BASE_URL)
  if (baseUrl.protocol !== 'https:') throw new Error('RUNTIME_RELEASE_BASE_URL must use HTTPS.')
  const names = (await readdir(inputDir)).filter(name => name.endsWith('.fragment.json'))
  if (names.length === 0) throw new Error('No runtime manifest fragments were found.')
  const fragments = await Promise.all(names.map(async name => JSON.parse(
    await readFile(path.join(inputDir, name), 'utf8'),
  )))
  const baseline = fragments[0]
  const artifacts = {}
  for (const fragment of fragments) {
    if (fragment.schemaVersion !== 1
      || fragment.version !== baseline.version
      || fragment.npmIntegrity !== baseline.npmIntegrity
      || fragment.node !== baseline.node) {
      throw new Error('Runtime fragments do not describe the same Harness and Node versions.')
    }
    artifacts[fragment.key] = {
      url: new URL(fragment.filename, baseUrl).href,
      sha256: fragment.sha256,
      size: fragment.size,
    }
  }
  const required = (process.env.RUNTIME_REQUIRED_KEYS ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
  for (const key of required) {
    if (artifacts[key] === undefined) throw new Error(`Required runtime artifact is absent: ${key}.`)
  }
  const channel = {
    schemaVersion: 1,
    package: PACKAGE_NAME,
    version: baseline.version,
    npmIntegrity: baseline.npmIntegrity,
    node: baseline.node,
    publishedAt: new Date().toISOString(),
    artifacts,
  }
  await writeFile(output, `${JSON.stringify(channel, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ output, artifacts: Object.keys(artifacts) }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
