'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const {
  createWindowOptions,
  isAllowedRuntimeUrl,
  isSafeExternalUrl,
} = require('../src/window-policy.cjs')

test('renderer has no Node integration and keeps Chromium isolation enabled', () => {
  const options = createWindowOptions('/application')
  assert.equal(options.webPreferences.nodeIntegration, false)
  assert.equal(options.webPreferences.contextIsolation, true)
  assert.equal(options.webPreferences.sandbox, true)
  assert.equal(options.webPreferences.webSecurity, true)
})

test('navigation accepts only the selected loopback origin', () => {
  const origin = 'http://127.0.0.1:43125'
  assert.equal(isAllowedRuntimeUrl(`${origin}/`, origin), true)
  assert.equal(isAllowedRuntimeUrl(`${origin}/settings`, origin), true)
  assert.equal(isAllowedRuntimeUrl('http://127.0.0.1:43126/', origin), false)
  assert.equal(isAllowedRuntimeUrl('http://example.com/', origin), false)
  assert.equal(isAllowedRuntimeUrl('file:///tmp/other.html', origin), false)
})

test('loading page is allowed only before a runtime origin is selected', () => {
  assert.equal(isAllowedRuntimeUrl('file:///application/loading.html', undefined), true)
  assert.equal(isAllowedRuntimeUrl('https://example.com/', undefined), false)
})

test('external links are limited to HTTP and HTTPS', () => {
  assert.equal(isSafeExternalUrl('https://deepseek.com/'), true)
  assert.equal(isSafeExternalUrl('http://example.test/'), true)
  assert.equal(isSafeExternalUrl('file:///etc/passwd'), false)
  assert.equal(isSafeExternalUrl('javascript:alert(1)'), false)
})
