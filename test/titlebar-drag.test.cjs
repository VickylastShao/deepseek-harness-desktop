'use strict'

const assert = require('node:assert/strict')
const { readFile } = require('node:fs/promises')
const path = require('node:path')
const test = require('node:test')

test('titlebar drag surface is transparent, local, and contains no executable script', async () => {
  const html = await readFile(
    path.join(__dirname, '..', 'src', 'renderer', 'titlebar-drag.html'),
    'utf8',
  )
  assert.match(html, /Content-Security-Policy/u)
  assert.match(html, /background:\s*transparent/u)
  assert.match(html, /(?:-webkit-)?app-region:\s*drag/u)
  assert.doesNotMatch(html, /<script/u)
})
