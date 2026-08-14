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

  isVisible() {
    return this.shown
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
  let updateCheckCount = 0
  let desktopUpdateCheckCount = 0
  let desktopCenterOpenCount = 0
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
    loginItemSupported: options.loginItemSupported ?? false,
    logDirectory: '/application/logs',
    onError: options.onError ?? (error => errors.push(error)),
    onQuit: () => {
      quitCount += 1
    },
    onCheckUpdates: async () => {
      updateCheckCount += 1
    },
    onCheckDesktopUpdates: async () => {
      desktopUpdateCheckCount += 1
    },
    onOpenDesktopCenter: () => {
      desktopCenterOpenCount += 1
    },
    onPreferenceChange: async patch => ({
      closeToTray: true,
      notifications: true,
      openAtLogin: false,
      ...options.preferences,
      ...patch,
    }),
    onRestart: async () => {
      restartCount += 1
    },
    openPath: async target => {
      openedPaths.push(target)
      return ''
    },
    trayIcon: { name: 'tray-icon' },
    preferences: options.preferences,
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
    updateCheckCount: () => updateCheckCount,
    desktopUpdateCheckCount: () => desktopUpdateCheckCount,
    desktopCenterOpenCount: () => desktopCenterOpenCount,
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

test('disabling close-to-tray turns the window close into an explicit quit', () => {
  const harness = createHarness({ preferences: { closeToTray: false } })
  const closeEvent = { prevented: false, preventDefault() { this.prevented = true } }

  harness.window.emit('close', closeEvent)

  assert.equal(closeEvent.prevented, true)
  assert.equal(harness.window.hidden, false)
  assert.equal(harness.quitCount(), 1)
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

test('desktop notifications can be disabled', () => {
  const harness = createHarness({ preferences: { notifications: false } })
  const closeEvent = { prevented: false, preventDefault() { this.prevented = true } }

  harness.window.emit('close', closeEvent)

  assert.equal(harness.window.hidden, true)
  assert.equal(harness.notifications.length, 0)
})

test('task completion notifications appear only while hidden and restore the window on click', () => {
  let created
  const harness = createHarness({
    createNotification: notificationOptions => {
      created = new EventEmitter()
      created.show = () => harness.notifications.push(notificationOptions)
      return created
    },
  })

  assert.equal(harness.controller.showTaskCompletedNotification('session-abcdef123456'), false)
  harness.window.hide()
  assert.equal(harness.controller.showTaskCompletedNotification('session-abcdef123456'), true)
  assert.equal(harness.notifications.length, 1)
  assert.equal(harness.notifications[0].title, 'Task completed')
  assert.match(harness.notifications[0].body, /session-abcd/u)

  created.emit('click')
  assert.equal(harness.window.shown, true)
  assert.equal(harness.window.focused, true)
})

test('task completion notifications respect the desktop notification preference', () => {
  const harness = createHarness({ preferences: { notifications: false } })
  harness.window.hide()

  assert.equal(harness.controller.showTaskCompletedNotification('session-1'), false)
  assert.equal(harness.notifications.length, 0)
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

  menu.find(item => item.id === 'desktop-center').click()
  await menu.find(item => item.id === 'restart').click()
  await menu.find(item => item.id === 'logs').click()
  menu.find(item => item.id === 'quit').click()

  assert.equal(harness.desktopCenterOpenCount(), 1)
  assert.equal(harness.restartCount(), 1)
  assert.deepEqual(harness.openedPaths, ['/application/logs'])
  assert.equal(harness.quitCount(), 1)
})

test('tray menu exposes runtime version and a manual update check', async () => {
  const harness = createHarness()
  harness.controller.setRuntimeUpdateState({
    phase: 'current',
    currentVersion: '0.1.0-rc.6',
  })

  const menu = harness.menuTemplate()
  assert.equal(menu.find(item => item.id === 'runtime-status').label, 'Harness 0.1.0-rc.6')
  await menu.find(item => item.id === 'check-updates').click()
  assert.equal(harness.updateCheckCount(), 1)
})

test('pending runtime updates are visible and cannot be checked twice', () => {
  const harness = createHarness({ locale: 'zh-CN' })
  harness.controller.setRuntimeUpdateState({
    phase: 'prepared',
    currentVersion: '0.1.0-rc.6',
    pendingVersion: '0.1.0-rc.7',
  })

  const menu = harness.menuTemplate()
  assert.equal(
    menu.find(item => item.id === 'runtime-status').label,
    'Harness 0.1.0-rc.6 · 重启后启用 0.1.0-rc.7',
  )
  assert.equal(menu.find(item => item.id === 'check-updates').enabled, false)
})

test('checking state prevents duplicate update checks', () => {
  const harness = createHarness()
  harness.controller.setRuntimeUpdateState({
    phase: 'checking',
    currentVersion: '0.1.0-rc.6',
  })

  const item = harness.menuTemplate().find(entry => entry.id === 'check-updates')
  assert.equal(item.label, 'Checking for Harness updates…')
  assert.equal(item.enabled, false)
})

test('signed builds expose desktop update state and manual checks', async () => {
  const harness = createHarness()
  harness.controller.setDesktopUpdateState({
    enabled: true,
    phase: 'current',
    currentVersion: '0.1.9',
  })

  let menu = harness.menuTemplate()
  assert.equal(menu.find(item => item.id === 'desktop-status').label, 'Desktop 0.1.9')
  await menu.find(item => item.id === 'check-desktop-updates').click()
  assert.equal(harness.desktopUpdateCheckCount(), 1)

  harness.controller.setDesktopUpdateState({
    phase: 'ready',
    availableVersion: '0.2.0',
  })
  menu = harness.menuTemplate()
  assert.equal(
    menu.find(item => item.id === 'desktop-status').label,
    'Desktop 0.1.9 · 0.2.0 ready after quit',
  )
  assert.equal(menu.find(item => item.id === 'check-desktop-updates').enabled, false)
})

test('tray preferences persist toggles and expose login startup only where supported', async () => {
  const harness = createHarness({ loginItemSupported: true })
  const submenu = harness.menuTemplate().find(item => item.id === 'preferences').submenu
  assert.equal(submenu.find(item => item.id === 'close-to-tray').checked, true)
  assert.equal(submenu.find(item => item.id === 'open-at-login').checked, false)

  await submenu.find(item => item.id === 'open-at-login').click()
  const updated = harness.menuTemplate().find(item => item.id === 'preferences').submenu
  assert.equal(updated.find(item => item.id === 'open-at-login').checked, true)

  const linuxHarness = createHarness({ loginItemSupported: false })
  const linuxSubmenu = linuxHarness.menuTemplate().find(item => item.id === 'preferences').submenu
  assert.equal(linuxSubmenu.some(item => item.id === 'open-at-login'), false)
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
