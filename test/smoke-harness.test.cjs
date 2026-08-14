'use strict'

const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const { resolveRuntimeRoot } = require('../scripts/smoke-harness.cjs')

test('runtime test root is absolute before the Harness working directory changes', () => {
  const projectRoot = path.resolve(path.sep, 'project')
  const base = path.resolve(path.sep, 'temporary', 'smoke')

  assert.equal(
    resolveRuntimeRoot(projectRoot, base, 'build/runtime-cache/linux-x64'),
    path.join(projectRoot, 'build', 'runtime-cache', 'linux-x64'),
  )
  assert.equal(
    resolveRuntimeRoot(projectRoot, base, undefined),
    path.join(base, 'runtime'),
  )
})
