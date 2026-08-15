'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const {
  calculateMainWindowLayout,
  createDesktopCenterWindowOptions,
  createRuntimeViewOptions,
  createTitlebarDragViewOptions,
  createWindowOptions,
  isAllowedRuntimeUrl,
  isSafeExternalUrl,
} = require('../src/window-policy.cjs')

test('desktop control center uses its own sandboxed preload', () => {
  const options = createDesktopCenterWindowOptions('/application')
  assert.equal(options.icon, pathFor('/assets/app-icon.png'))
  assert.match(options.webPreferences.preload, /desktop-center-preload\.cjs$/u)
  assert.equal(options.webPreferences.nodeIntegration, false)
  assert.equal(options.webPreferences.contextIsolation, true)
  assert.equal(options.webPreferences.sandbox, true)
  assert.equal(options.webPreferences.webSecurity, true)
})

test('renderer has no Node integration and keeps Chromium isolation enabled', () => {
  const options = createWindowOptions('/application', 'win32')
  assert.equal(options.icon, pathFor('/assets/app-icon.png'))
  assert.equal(options.titleBarStyle, 'hidden')
  assert.deepEqual(options.titleBarOverlay, {
    color: '#121214',
    symbolColor: '#c9cbd0',
    height: 44,
  })
})

test('macOS keeps inset native traffic lights without a Windows overlay', () => {
  const options = createWindowOptions('/application', 'darwin')
  assert.equal(options.titleBarStyle, 'hiddenInset')
  assert.equal(options.titleBarOverlay, undefined)
})

test('runtime and drag views keep Chromium isolation enabled', () => {
  const runtime = createRuntimeViewOptions('/application')
  const drag = createTitlebarDragViewOptions()
  assert.match(runtime.webPreferences.preload, /preload\.cjs$/u)
  for (const options of [runtime, drag]) {
    assert.equal(options.webPreferences.nodeIntegration, false)
    assert.equal(options.webPreferences.contextIsolation, true)
    assert.equal(options.webPreferences.sandbox, true)
    assert.equal(options.webPreferences.webSecurity, true)
  }
})

test('main content fills the client area while the drag surface avoids native controls', () => {
  assert.deepEqual(calculateMainWindowLayout([1280, 840], 'win32'), {
    runtime: { x: 0, y: 0, width: 1280, height: 840 },
    titlebarDrag: { x: 280, y: 0, width: 862, height: 44 },
  })
  assert.deepEqual(calculateMainWindowLayout([1280, 840], 'darwin'), {
    runtime: { x: 0, y: 0, width: 1280, height: 840 },
    titlebarDrag: { x: 280, y: 0, width: 1000, height: 44 },
  })
})

function pathFor(value) {
  return process.platform === 'win32' ? value.replaceAll('/', '\\') : value
}

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
