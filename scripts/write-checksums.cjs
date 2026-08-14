'use strict'

const { createHash } = require('node:crypto')
const { readdir, readFile, stat, writeFile } = require('node:fs/promises')
const path = require('node:path')

async function main() {
  const directory = path.resolve(process.argv[2] ?? 'release')
  const output = path.resolve(process.argv[3] ?? path.join(directory, 'SHA256SUMS.txt'))
  const entries = []
  const distributableExtensions = new Set([
    '.AppImage', '.deb', '.dmg', '.exe', '.json', '.tgz', '.zip',
  ])
  for (const name of (await readdir(directory)).sort()) {
    const filename = path.join(directory, name)
    if (filename === output
      || !distributableExtensions.has(path.extname(name))
      || !(await stat(filename)).isFile()) continue
    const digest = createHash('sha256').update(await readFile(filename)).digest('hex')
    entries.push(`${digest}  ${name}`)
  }
  await writeFile(output, `${entries.join('\n')}\n`, 'utf8')
  console.log(`Wrote ${entries.length} checksums to ${output}`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
