'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const {
  artifactNames,
  generateReleaseNotes,
} = require('../scripts/generate-release-notes.cjs')

test('release notes expose direct links for every supported installer target', () => {
  const notes = generateReleaseNotes({
    repository: 'VickylastShao/deepseek-harness-desktop',
    tag: 'v0.3.0',
    version: '0.3.0',
    changes: '## Changes\n\n- Added diagnostics.',
  })

  for (const name of Object.values(artifactNames('0.3.0')).flat()) {
    assert.match(notes, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'))
  }
  assert.match(notes, /releases\/download\/v0\.3\.0\/DeepSeek-Harness-Desktop-0\.3\.0-win-x64\.exe/u)
  assert.match(notes, /Added diagnostics/u)
  assert.match(notes, /SHA-256/u)
})

test('release notes reject tags, versions, and repositories that could produce broken links', () => {
  assert.throws(() => generateReleaseNotes({ repository: 'owner/repo', tag: 'v0.3.1', version: '0.3.0' }), /tag/u)
  assert.throws(() => generateReleaseNotes({ repository: 'not a repo', tag: 'v0.3.0', version: '0.3.0' }), /repository/u)
  assert.throws(() => artifactNames('../bad'), /version/u)
})
