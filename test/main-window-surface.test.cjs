'use strict'

const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const { createMainWindowSurface } = require('../src/main-window-surface.cjs')

class FakeWebContents {
  constructor() {
    this.closed = false
    this.loadedFile = undefined
  }

  close() {
    this.closed = true
  }

  isDestroyed() {
    return this.closed
  }

  async loadFile(file) {
    this.loadedFile = file
  }
}

class FakeWebContentsView {
  constructor(options) {
    this.options = options
    this.webContents = new FakeWebContents()
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
  assert.deepEqual(surface.titlebarDragView.bounds, { x: 280, y: 0, width: 862, height: 44 })
  assert.equal(surface.titlebarDragView.backgroundColor, '#00000000')
  assert.equal(
    surface.titlebarDragView.webContents.loadedFile,
    pathFor('/application/renderer/titlebar-drag.html'),
  )

  window.contentSize = [1440, 900]
  window.emit('resize')
  assert.deepEqual(surface.runtimeView.bounds, { x: 0, y: 0, width: 1440, height: 900 })
  assert.deepEqual(surface.titlebarDragView.bounds, { x: 280, y: 0, width: 1022, height: 44 })

  window.emit('closed')
  assert.equal(surface.runtimeView.webContents.closed, true)
  assert.equal(surface.titlebarDragView.webContents.closed, true)
  assert.equal(window.listeners.has('resize'), false)
})

function pathFor(value) {
  return process.platform === 'win32' ? value.replaceAll('/', '\\') : value
}
