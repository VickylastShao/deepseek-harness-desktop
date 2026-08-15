'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const {
  applyMainWindowAppearance,
  calculateMainWindowLayout,
  createDesktopCenterWindowOptions,
  createMainWindowAppearance,
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
  assert.equal(options.backgroundColor, '#f5f7fb')
  assert.deepEqual(options.titleBarOverlay, {
    color: '#00000000',
    symbolColor: '#172033',
    height: 44,
  })
  assert.equal(options.webPreferences, undefined)
})

test('native window controls follow loading and runtime surface contrast', () => {
  assert.deepEqual(createMainWindowAppearance('loading', 'win32'), {
    backgroundColor: '#f5f7fb',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#172033',
      height: 44,
    },
  })
  assert.deepEqual(createMainWindowAppearance('runtime', 'win32'), {
    backgroundColor: '#121214',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#c9cbd0',
      height: 44,
    },
  })
  assert.deepEqual(createMainWindowAppearance('loading', 'darwin'), {
    backgroundColor: '#f5f7fb',
  })
  assert.throws(() => createMainWindowAppearance('unknown', 'win32'), /Unknown main window appearance/u)
})

test('native window appearance is updated through Electron window APIs', () => {
  const calls = []
  const window = {
    setBackgroundColor: color => calls.push(['background', color]),
    setTitleBarOverlay: overlay => calls.push(['overlay', overlay]),
  }

  applyMainWindowAppearance(window, 'runtime', 'win32')
  assert.deepEqual(calls, [
    ['background', '#121214'],
    ['overlay', { color: '#00000000', symbolColor: '#c9cbd0', height: 44 }],
  ])

  calls.length = 0
  applyMainWindowAppearance(window, 'loading', 'darwin')
  assert.deepEqual(calls, [['background', '#f5f7fb']])
})

test('Linux uses the same native overlay contract as Windows', () => {
  const options = createWindowOptions('/application', 'linux')
  assert.equal(options.titleBarStyle, 'hidden')
  assert.equal(options.titleBarOverlay.height, 44)
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
    titlebarDrag: { x: 420, y: 0, width: 722, height: 44 },
  })
  assert.deepEqual(calculateMainWindowLayout([1280, 840], 'darwin'), {
    runtime: { x: 0, y: 0, width: 1280, height: 840 },
    titlebarDrag: { x: 420, y: 0, width: 860, height: 44 },
  })
  assert.deepEqual(calculateMainWindowLayout([-1, 20], 'linux'), {
    runtime: { x: 0, y: 0, width: 0, height: 20 },
    titlebarDrag: { x: 420, y: 0, width: 0, height: 20 },
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
