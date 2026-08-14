'use strict'

const ENGLISH_LABELS = Object.freeze({
  logs: 'Open Log Folder',
  open: 'Open DeepSeek Harness',
  quit: 'Quit',
  restart: 'Restart Harness',
  stillRunningBody: 'DeepSeek Harness is still running in the system tray.',
  stillRunningTitle: 'DeepSeek Harness Desktop',
  tooltip: 'DeepSeek Harness Desktop',
})

const CHINESE_LABELS = Object.freeze({
  logs: '打开日志目录',
  open: '打开 DeepSeek Harness',
  quit: '彻底退出',
  restart: '重启 Harness',
  stillRunningBody: 'DeepSeek Harness 仍在系统托盘中运行。',
  stillRunningTitle: 'DeepSeek Harness Desktop',
  tooltip: 'DeepSeek Harness Desktop',
})

function trayLabels(locale) {
  return typeof locale === 'string' && locale.toLowerCase().startsWith('zh')
    ? CHINESE_LABELS
    : ENGLISH_LABELS
}

function createTrayImage(nativeImage, iconBuffer, platform = process.platform) {
  const size = platform === 'darwin' ? 18 : 24
  const image = nativeImage.createFromBuffer(iconBuffer).resize({
    width: size,
    height: size,
    quality: 'best',
  })
  if (image.isEmpty()) throw new Error('Unable to create the system tray icon.')
  if (platform === 'darwin') image.setTemplateImage(true)
  return image
}

class DesktopTrayController {
  constructor(options) {
    this.createTray = options.createTray
    this.buildMenu = options.buildMenu
    this.createNotification = options.createNotification
    this.isNotificationSupported = options.isNotificationSupported
    this.isQuitting = options.isQuitting
    this.labels = options.labels
    this.logDirectory = options.logDirectory
    this.onError = options.onError
    this.onQuit = options.onQuit
    this.onRestart = options.onRestart
    this.openPath = options.openPath
    this.trayIcon = options.trayIcon
    this.window = undefined
    this.tray = undefined
    this.closeNotificationShown = false
    this.handleClose = event => this.hideOnClose(event)
    this.handleTrayClick = () => this.showWindow()
  }

  initialize(window) {
    if (this.tray !== undefined) throw new Error('Desktop tray is already initialized.')
    this.window = window
    window.on('close', this.handleClose)

    const tray = this.createTray(this.trayIcon)
    this.tray = tray
    tray.setToolTip(this.labels.tooltip)
    tray.setContextMenu(this.buildMenu([
      { id: 'open', label: this.labels.open, click: () => this.showWindow() },
      { type: 'separator' },
      { id: 'restart', label: this.labels.restart, click: () => this.runAction(this.onRestart) },
      { id: 'logs', label: this.labels.logs, click: () => this.openLogDirectory() },
      { type: 'separator' },
      { id: 'quit', label: this.labels.quit, click: () => this.onQuit() },
    ]))
    tray.on('click', this.handleTrayClick)
    tray.on('double-click', this.handleTrayClick)
  }

  hideOnClose(event) {
    if (this.isQuitting()) return
    event.preventDefault()
    this.window?.hide()
    this.showCloseNotificationOnce()
  }

  showCloseNotificationOnce() {
    if (this.closeNotificationShown || !this.isNotificationSupported()) return
    this.closeNotificationShown = true
    try {
      this.createNotification({
        title: this.labels.stillRunningTitle,
        body: this.labels.stillRunningBody,
      }).show()
    } catch (error) {
      this.onError(error instanceof Error ? error : new Error(String(error)))
    }
  }

  showWindow() {
    const window = this.window
    if (window === undefined || window.isDestroyed()) return
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  }

  async runAction(action) {
    try {
      await action()
    } catch (error) {
      this.onError(error instanceof Error ? error : new Error(String(error)))
    }
  }

  async openLogDirectory() {
    await this.runAction(async () => {
      const errorMessage = await this.openPath(this.logDirectory)
      if (errorMessage !== '') throw new Error(errorMessage)
    })
  }

  dispose() {
    this.window?.removeListener('close', this.handleClose)
    this.window = undefined
    if (this.tray !== undefined) {
      this.tray.removeListener('click', this.handleTrayClick)
      this.tray.removeListener('double-click', this.handleTrayClick)
      this.tray.destroy()
      this.tray = undefined
    }
  }
}

module.exports = {
  createTrayImage,
  DesktopTrayController,
  trayLabels,
}
