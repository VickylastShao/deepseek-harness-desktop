'use strict'

const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const {
  createMainWindowSurface,
  installRuntimeNavigationGuards,
} = require('../src/main-window-surface.cjs')

class FakeWebContents {
  constructor({ loadError } = {}) {
    this.closed = false
    this.loadedFile = undefined
    this.loadError = loadError
  }

  close() {
    this.closed = true
  }

  isDestroyed() {
    return this.closed
  }

  async loadFile(file) {
    this.loadedFile = file
    if (this.loadError !== undefined) throw this.loadError
  }
}

class FakeWebContentsView {
  constructor(options) {
    this.options = options
    this.webContents = new FakeWebContents(FakeWebContentsView.nextContentsOptions)
    FakeWebContentsView.nextContentsOptions = undefined
  }

  setBackgroundColor(color) {
    this.backgroundColor = color
  }

  setBounds(bounds) {
    this.bounds = bounds
  }
}

class FakeWindow {
  constructor() {
    this.contentSize = [1280, 840]
    this.listeners = new Map()
    this.contentView = {
      children: [],
      addChildView: view => this.contentView.children.push(view),
      removeChildView: view => {
        this.contentView.children = this.contentView.children.filter(child => child !== view)
      },
    }
  }

  emit(event) {
    this.listeners.get(event)?.()
  }

  getContentSize() {
    return this.contentSize
  }

  on(event, listener) {
    this.listeners.set(event, listener)
  }

  removeListener(event, listener) {
    if (this.listeners.get(event) === listener) this.listeners.delete(event)
  }
}

test('surface keeps Harness full-bleed and places a transparent drag view above it', async () => {
  const window = new FakeWindow()
  const surface = await createMainWindowSurface({
    baseDir: '/application',
    platform: 'win32',
    WebContentsView: FakeWebContentsView,
    window,
  })

  assert.deepEqual(window.contentView.children, [surface.runtimeView, surface.titlebarDragView])
  assert.deepEqual(surface.runtimeView.bounds, { x: 0, y: 0, width: 1280, height: 840 })
  assert.deepEqual(surface.titlebarDragView.bounds, { x: 420, y: 0, width: 722, height: 44 })
  assert.equal(surface.titlebarDragView.backgroundColor, '#00000000')
  assert.equal(
    surface.titlebarDragView.webContents.loadedFile,
    pathFor('/application/renderer/titlebar-drag.html'),
  )

  window.contentSize = [1440, 900]
  window.emit('resize')
  assert.deepEqual(surface.runtimeView.bounds, { x: 0, y: 0, width: 1440, height: 900 })
  assert.deepEqual(surface.titlebarDragView.bounds, { x: 420, y: 0, width: 882, height: 44 })

  surface.dispose()
  assert.equal(surface.runtimeView.webContents.closed, true)
  assert.equal(surface.titlebarDragView.webContents.closed, true)
  assert.equal(window.listeners.has('resize'), false)
  assert.equal(window.listeners.has('closed'), false)
  assert.equal(window.contentView.children.length, 0)

  surface.dispose()
  assert.equal(surface.runtimeView.webContents.closed, true)
})

test('closed event closes child web contents without touching the destroyed window view tree', async () => {
  const window = new FakeWindow()
  const surface = await createMainWindowSurface({
    baseDir: '/application',
    platform: 'darwin',
    WebContentsView: FakeWebContentsView,
    window,
  })
  window.contentView.removeChildView = () => {
    throw new Error('contentView is unavailable after closed')
  }

  window.emit('closed')

  assert.equal(surface.runtimeView.webContents.closed, true)
  assert.equal(surface.titlebarDragView.webContents.closed, true)
})

test('surface rolls back attached views and listeners when the drag page fails to load', async () => {
  const window = new FakeWindow()
  const loadError = new Error('drag page unavailable')
  let viewCount = 0
  class FailingWebContentsView extends FakeWebContentsView {
    constructor(options) {
      if (viewCount === 1) FakeWebContentsView.nextContentsOptions = { loadError }
      super(options)
      viewCount += 1
    }
  }

  await assert.rejects(
    createMainWindowSurface({
      baseDir: '/application',
      platform: 'linux',
      WebContentsView: FailingWebContentsView,
      window,
    }),
    loadError,
  )

  assert.equal(window.listeners.has('resize'), false)
  assert.equal(window.contentView.children.length, 0)
})

test('runtime navigation guards keep navigation local and hand safe links to the OS', () => {
  const listeners = new Map()
  const opened = []
  const webContents = {
    on: (event, listener) => listeners.set(event, listener),
    setWindowOpenHandler: handler => { webContents.openHandler = handler },
  }
  let runtimeOrigin
  installRuntimeNavigationGuards({
    getRuntimeOrigin: () => runtimeOrigin,
    openExternal: url => opened.push(url),
    webContents,
  })

  assert.deepEqual(webContents.openHandler({ url: 'https://example.com/help' }), {
    action: 'deny',
  })
  assert.deepEqual(opened, ['https://example.com/help'])
  webContents.openHandler({ url: 'file:///etc/passwd' })
  assert.deepEqual(opened, ['https://example.com/help'])

  const blockedBeforeStartup = preventableEvent()
  listeners.get('will-navigate')(blockedBeforeStartup, 'http://127.0.0.1:3010/')
  assert.equal(blockedBeforeStartup.prevented, true)

  runtimeOrigin = 'http://127.0.0.1:3010'
  const allowedRuntime = preventableEvent()
  listeners.get('will-navigate')(allowedRuntime, 'http://127.0.0.1:3010/session/1')
  assert.equal(allowedRuntime.prevented, false)

  const blockedOrigin = preventableEvent()
  listeners.get('will-navigate')(blockedOrigin, 'http://127.0.0.1:3011/')
  assert.equal(blockedOrigin.prevented, true)
})

function preventableEvent() {
  return {
    prevented: false,
    preventDefault() { this.prevented = true },
  }
}

function pathFor(value) {
  return process.platform === 'win32' ? value.replaceAll('/', '\\') : value
}
