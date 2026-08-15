'use strict'

const ENGLISH_LABELS = Object.freeze({
  checkUpdates: 'Check for Harness Updates',
  checkDesktopUpdates: 'Check for Desktop Updates',
  checkingUpdates: 'Checking for Harness updates…',
  checkingDesktopUpdates: 'Checking for desktop updates…',
  closeToTray: 'Keep Running When Window Closes',
  desktopCenter: 'Desktop Control Center',
  logs: 'Open Log Folder',
  notifications: 'Desktop Notifications',
  open: 'Open DeepSeek Harness',
  openAtLogin: 'Start at Login',
  preferences: 'Preferences',
  pendingUpdate: (current, pending) => `Harness ${current} · ${pending} ready after restart`,
  pendingDesktopUpdate: (current, pending) => `Desktop ${current} · ${pending} ready after quit`,
  quit: 'Quit',
  restart: 'Restart Harness',
  runtimeVersion: version => `Harness ${version}`,
  desktopVersion: version => `Desktop ${version}`,
  stillRunningBody: 'DeepSeek Harness is still running in the system tray.',
  stillRunningTitle: 'DeepSeek Harness Desktop',
  taskCompletedBody: session => `Harness task ${session} finished. Click to reopen the app.`,
  taskCompletedTitle: 'Task completed',
  tooltip: 'DeepSeek Harness Desktop',
})

const CHINESE_LABELS = Object.freeze({
  checkUpdates: '检查 Harness 更新',
  checkDesktopUpdates: '检查桌面应用更新',
  checkingUpdates: '正在检查 Harness 更新……',
  checkingDesktopUpdates: '正在检查桌面应用更新……',
  closeToTray: '关闭窗口后继续运行',
  desktopCenter: '桌面控制中心',
  logs: '打开日志目录',
  notifications: '桌面通知',
  open: '打开 DeepSeek Harness',
  openAtLogin: '开机启动',
  preferences: '偏好设置',
  pendingUpdate: (current, pending) => `Harness ${current} · 重启后启用 ${pending}`,
  pendingDesktopUpdate: (current, pending) => `桌面应用 ${current} · 退出后安装 ${pending}`,
  quit: '彻底退出',
  restart: '重启 Harness',
  runtimeVersion: version => `Harness ${version}`,
  desktopVersion: version => `桌面应用 ${version}`,
  stillRunningBody: 'DeepSeek Harness 仍在系统托盘中运行。',
  stillRunningTitle: 'DeepSeek Harness Desktop',
  taskCompletedBody: session => `Harness 任务 ${session} 已完成，点击重新打开应用。`,
  taskCompletedTitle: '任务已完成',
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

function trayIconFilename(isDark, platform = process.platform) {
  return platform === 'darwin' || isDark
    ? 'tray-icon-dark.png'
    : 'tray-icon-light.png'
}

class DesktopTrayController {
  constructor(options) {
    this.createTray = options.createTray
    this.buildMenu = options.buildMenu
    this.createNotification = options.createNotification
    this.isNotificationSupported = options.isNotificationSupported
    this.isQuitting = options.isQuitting
    this.labels = options.labels
    this.loginItemSupported = options.loginItemSupported ?? false
    this.logDirectory = options.logDirectory
    this.onError = options.onError
    this.onQuit = options.onQuit
    this.onRestart = options.onRestart
    this.onCheckUpdates = options.onCheckUpdates ?? (() => {})
    this.onCheckDesktopUpdates = options.onCheckDesktopUpdates ?? (() => {})
    this.onOpenDesktopCenter = options.onOpenDesktopCenter ?? (() => {})
    this.onPreferenceChange = options.onPreferenceChange ?? (async () => this.preferences)
    this.openPath = options.openPath
    this.trayIcon = options.trayIcon
    this.window = undefined
    this.tray = undefined
    this.closeNotificationShown = false
    this.preferences = {
      closeToTray: true,
      notifications: true,
      openAtLogin: false,
      ...options.preferences,
    }
    this.updateState = { phase: 'idle' }
    this.desktopUpdateState = { enabled: false, phase: 'disabled' }
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
    this.rebuildMenu()
    tray.on('click', this.handleTrayClick)
    tray.on('double-click', this.handleTrayClick)
  }

  rebuildMenu() {
    if (this.tray === undefined) return
    const { currentVersion, pendingVersion, phase } = this.updateState
    const desktop = this.desktopUpdateState
    let statusLabel
    if (currentVersion !== undefined && pendingVersion !== undefined) {
      statusLabel = this.labels.pendingUpdate(currentVersion, pendingVersion)
    } else if (currentVersion !== undefined) {
      statusLabel = this.labels.runtimeVersion(currentVersion)
    }
    const checking = phase === 'checking' || phase === 'downloading'
    this.tray.setContextMenu(this.buildMenu([
      { id: 'open', label: this.labels.open, click: () => this.showWindow() },
      { id: 'desktop-center', label: this.labels.desktopCenter, click: () => this.onOpenDesktopCenter() },
      { type: 'separator' },
      ...(statusLabel === undefined ? [] : [{ id: 'runtime-status', label: statusLabel, enabled: false }]),
      {
        id: 'check-updates',
        label: checking ? this.labels.checkingUpdates : this.labels.checkUpdates,
        enabled: !checking && pendingVersion === undefined,
        click: () => this.runAction(this.onCheckUpdates),
      },
      ...(desktop.enabled ? [
        {
          id: 'desktop-status',
          label: desktop.availableVersion === undefined
            ? this.labels.desktopVersion(desktop.currentVersion)
            : this.labels.pendingDesktopUpdate(desktop.currentVersion, desktop.availableVersion),
          enabled: false,
        },
        {
          id: 'check-desktop-updates',
          label: desktop.phase === 'checking'
            ? this.labels.checkingDesktopUpdates
            : this.labels.checkDesktopUpdates,
          enabled: !['checking', 'downloading', 'ready'].includes(desktop.phase),
          click: () => this.runAction(this.onCheckDesktopUpdates),
        },
      ] : []),
      { id: 'restart', label: this.labels.restart, click: () => this.runAction(this.onRestart) },
      { id: 'logs', label: this.labels.logs, click: () => this.openLogDirectory() },
      {
        id: 'preferences',
        label: this.labels.preferences,
        submenu: [
          {
            id: 'close-to-tray',
            label: this.labels.closeToTray,
            type: 'checkbox',
            checked: this.preferences.closeToTray,
            click: () => this.updatePreference('closeToTray'),
          },
          {
            id: 'notifications',
            label: this.labels.notifications,
            type: 'checkbox',
            checked: this.preferences.notifications,
            click: () => this.updatePreference('notifications'),
          },
          ...(this.loginItemSupported ? [{
            id: 'open-at-login',
            label: this.labels.openAtLogin,
            type: 'checkbox',
            checked: this.preferences.openAtLogin,
            click: () => this.updatePreference('openAtLogin'),
          }] : []),
        ],
      },
      { type: 'separator' },
      { id: 'quit', label: this.labels.quit, click: () => this.onQuit() },
    ]))
  }

  setRuntimeUpdateState(state) {
    this.updateState = { ...this.updateState, ...state }
    this.rebuildMenu()
  }

  setDesktopUpdateState(state) {
    this.desktopUpdateState = { ...this.desktopUpdateState, ...state }
    this.rebuildMenu()
  }

  setIcon(icon) {
    this.trayIcon = icon
    this.tray?.setImage(icon)
  }

  async updatePreference(key) {
    await this.runAction(async () => {
      this.preferences = await this.onPreferenceChange({
        [key]: !this.preferences[key],
      })
      this.rebuildMenu()
    })
  }

  hideOnClose(event) {
    if (this.isQuitting()) return
    event.preventDefault()
    if (!this.preferences.closeToTray) {
      this.onQuit()
      return
    }
    this.window?.hide()
    this.showCloseNotificationOnce()
  }

  showCloseNotificationOnce() {
    if (this.closeNotificationShown
      || !this.preferences.notifications
      || !this.isNotificationSupported()) return
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

  showTaskCompletedNotification(sessionId) {
    const window = this.window
    if (!this.preferences.notifications
      || !this.isNotificationSupported()
      || (window !== undefined && !window.isDestroyed() && window.isVisible() && !window.isMinimized())) return false
    try {
      const session = sessionId.length > 12 ? `${sessionId.slice(0, 12)}…` : sessionId
      const notification = this.createNotification({
        title: this.labels.taskCompletedTitle,
        body: this.labels.taskCompletedBody(session),
      })
      notification.on?.('click', () => this.showWindow())
      notification.show()
      return true
    } catch (error) {
      this.onError(error instanceof Error ? error : new Error(String(error)))
      return false
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
  trayIconFilename,
  trayLabels,
}
