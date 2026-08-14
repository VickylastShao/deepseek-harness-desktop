'use strict'

const assert = require('node:assert/strict')
const { readFile } = require('node:fs/promises')
const path = require('node:path')
const test = require('node:test')
const { artifactNames } = require('../scripts/generate-release-notes.cjs')
const manifest = require('../package.json')

const projectRoot = path.resolve(__dirname, '..')

test('bilingual READMEs link every current release package and checksum', async () => {
  const documents = await Promise.all([
    readFile(path.join(projectRoot, 'README.md'), 'utf8'),
    readFile(path.join(projectRoot, 'README.zh-CN.md'), 'utf8'),
  ])
  const names = new Set(Object.values(artifactNames(manifest.version)).flat())

  for (const document of documents) {
    for (const name of names) assert.match(document, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'))
    assert.match(document, new RegExp(`v${manifest.version.replaceAll('.', '\\.')}\\b`, 'u'))
  }
})
