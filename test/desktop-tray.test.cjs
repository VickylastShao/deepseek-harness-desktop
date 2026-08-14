'use strict'

const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const test = require('node:test')
const {
  createTrayImage,
  DesktopTrayController,
  trayLabels,
} = require('../src/desktop-tray.cjs')

class FakeWindow extends EventEmitter {
  constructor() {
    super()
    this.destroyed = false
    this.focused = false
    this.hidden = false
    this.minimized = false
    this.shown = true
  }

  focus() {
    this.focused = true
  }

  hide() {
    this.hidden = true
    this.shown = false
  }

  isDestroyed() {
    return this.destroyed
  }

  isMinimized() {
    return this.minimized
  }

  restore() {
    this.minimized = false
  }

  show() {
    this.hidden = false
    this.shown = true
  }
}

class FakeTray extends EventEmitter {
  constructor() {
    super()
    this.destroyed = false
  }

  destroy() {
    this.destroyed = true
  }

  setContextMenu(menu) {
    this.menu = menu
  }

  setToolTip(tooltip) {
    this.tooltip = tooltip
  }
}

function createHarness(options = {}) {
  const notifications = []
  const openedPaths = []
  const errors = []
  let menuTemplate
  let restartCount = 0
  let quitCount = 0
  const tray = new FakeTray()
  const window = new FakeWindow()
  const controller = new DesktopTrayController({
    createTray: () => tray,
    buildMenu: template => {
      menuTemplate = template
      return template
    },
    createNotification: options.createNotification ?? (notificationOptions => ({
      show() {
        notifications.push(notificationOptions)
      },
    })),
    isNotificationSupported: () => true,
    isQuitting: options.isQuitting ?? (() => false),
    labels: trayLabels(options.locale ?? 'en-US'),
    logDirectory: '/application/logs',
    onError: options.onError ?? (error => errors.push(error)),
    onQuit: () => {
      quitCount += 1
    },
    onRestart: async () => {
      restartCount += 1
    },
    openPath: async target => {
      openedPaths.push(target)
      return ''
    },
    trayIcon: { name: 'tray-icon' },
  })
  controller.initialize(window)
  return {
    controller,
    errors,
    menuTemplate: () => menuTemplate,
    notifications,
    openedPaths,
    quitCount: () => quitCount,
    restartCount: () => restartCount,
    tray,
    window,
  }
}

test('closing the window hides it and reports tray residency only once', () => {
  const harness = createHarness()

  const firstClose = { prevented: false, preventDefault() { this.prevented = true } }
  harness.window.emit('close', firstClose)
  const secondClose = { prevented: false, preventDefault() { this.prevented = true } }
  harness.window.emit('close', secondClose)

  assert.equal(firstClose.prevented, true)
  assert.equal(secondClose.prevented, true)
  assert.equal(harness.window.hidden, true)
  assert.equal(harness.notifications.length, 1)
  assert.equal(harness.notifications[0].title, 'DeepSeek Harness Desktop')
})

test('explicit application quit allows the window to close normally', () => {
  const harness = createHarness({ isQuitting: () => true })
  const closeEvent = { prevented: false, preventDefault() { this.prevented = true } }

  harness.window.emit('close', closeEvent)

  assert.equal(closeEvent.prevented, false)
  assert.equal(harness.window.hidden, false)
  assert.equal(harness.notifications.length, 0)
})

test('notification failures never prevent the window from hiding', () => {
  const harness = createHarness({
    createNotification: () => ({
      show() {
        throw new Error('notification service unavailable')
      },
    }),
  })
  const closeEvent = { prevented: false, preventDefault() { this.prevented = true } }

  assert.doesNotThrow(() => harness.window.emit('close', closeEvent))

  assert.equal(closeEvent.prevented, true)
  assert.equal(harness.window.hidden, true)
  assert.equal(harness.errors.length, 1)
  assert.match(harness.errors[0].message, /notification service unavailable/u)
})

test('tray clicks and the open action restore and focus the existing window', () => {
  const harness = createHarness()
  harness.window.minimized = true
  harness.window.hide()

  harness.tray.emit('click')

  assert.equal(harness.window.minimized, false)
  assert.equal(harness.window.shown, true)
  assert.equal(harness.window.focused, true)

  harness.window.focused = false
  const openItem = harness.menuTemplate().find(item => item.id === 'open')
  openItem.click()
  assert.equal(harness.window.focused, true)
})

test('tray menu exposes restart, logs, and explicit quit actions', async () => {
  const harness = createHarness()
  const menu = harness.menuTemplate()

  await menu.find(item => item.id === 'restart').click()
  await menu.find(item => item.id === 'logs').click()
  menu.find(item => item.id === 'quit').click()

  assert.equal(harness.restartCount(), 1)
  assert.deepEqual(harness.openedPaths, ['/application/logs'])
  assert.equal(harness.quitCount(), 1)
})

test('tray labels follow the application locale', () => {
  assert.equal(trayLabels('en-US').quit, 'Quit')
  assert.equal(trayLabels('zh-CN').quit, '彻底退出')
  assert.equal(trayLabels('zh-TW').logs, '打开日志目录')
})

test('tray artwork is rendered at a native platform size', () => {
  const state = { template: false }
  const image = {
    isEmpty: () => false,
    resize(options) {
      state.resize = options
      return this
    },
    setTemplateImage(value) {
      state.template = value
    },
  }
  const nativeImage = {
    createFromBuffer(value) {
      state.buffer = value
      return image
    },
  }
  const iconBuffer = Buffer.from('png')

  assert.equal(createTrayImage(nativeImage, iconBuffer, 'darwin'), image)
  assert.equal(state.buffer, iconBuffer)
  assert.deepEqual(state.resize, { width: 18, height: 18, quality: 'best' })
  assert.equal(state.template, true)
})

test('empty tray artwork fails before the application starts', () => {
  const emptyImage = {
    isEmpty: () => true,
    resize() { return this },
    setTemplateImage() {},
  }

  assert.throws(
    () => createTrayImage({ createFromBuffer: () => emptyImage }, Buffer.from('png'), 'linux'),
    /Unable to create the system tray icon/u,
  )
})

test('disposing the controller removes the close handler and destroys the tray', () => {
  const harness = createHarness()

  harness.controller.dispose()
  const closeEvent = { prevented: false, preventDefault() { this.prevented = true } }
  harness.window.emit('close', closeEvent)

  assert.equal(closeEvent.prevented, false)
  assert.equal(harness.tray.destroyed, true)
})
