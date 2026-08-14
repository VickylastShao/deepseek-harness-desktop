'use strict'

class DesktopAppUpdater {
  constructor(options) {
    this.updater = options.updater
    this.enabled = options.enabled
    this.currentVersion = options.currentVersion
    this.delayMs = options.delayMs ?? 60_000
    this.intervalMs = options.intervalMs ?? 6 * 60 * 60_000
    this.onState = options.onState ?? (() => {})
    this.onError = options.onError ?? (() => {})
    this.setTimer = options.setTimer ?? setTimeout
    this.clearTimer = options.clearTimer ?? clearTimeout
    this.timer = undefined
    this.started = false
    this.checking = false
    this.state = {
      enabled: this.enabled,
      phase: this.enabled ? 'idle' : 'disabled',
      currentVersion: this.currentVersion,
    }
    this.listeners = {
      checking: () => this.publish({ phase: 'checking' }),
      available: info => this.publish({ phase: 'downloading', availableVersion: info.version }),
      current: () => {
        this.publish({ phase: 'current', availableVersion: undefined, progress: undefined })
        this.schedule(this.intervalMs)
      },
      progress: progress => this.publish({
        phase: 'downloading',
        progress: Number.isFinite(progress.percent) ? Math.max(0, Math.min(100, progress.percent)) : undefined,
      }),
      downloaded: info => this.publish({
        phase: 'ready',
        availableVersion: info.version,
        progress: 100,
      }),
      error: error => this.handleError(error),
    }
    if (this.enabled) this.attach()
    this.publish({})
  }

  attach() {
    this.updater.autoDownload = true
    this.updater.autoInstallOnAppQuit = true
    this.updater.autoRunAppAfterInstall = false
    this.updater.allowPrerelease = false
    this.updater.disableDifferentialDownload = true
    this.updater.on('checking-for-update', this.listeners.checking)
    this.updater.on('update-available', this.listeners.available)
    this.updater.on('update-not-available', this.listeners.current)
    this.updater.on('download-progress', this.listeners.progress)
    this.updater.on('update-downloaded', this.listeners.downloaded)
    this.updater.on('error', this.listeners.error)
  }

  publish(patch) {
    this.state = { ...this.state, ...patch }
    this.onState({ ...this.state })
  }

  start() {
    if (!this.enabled || this.started) return false
    this.started = true
    this.schedule(this.delayMs)
    return true
  }

  schedule(delayMs) {
    if (!this.enabled || this.timer !== undefined || this.state.phase === 'ready') return
    this.timer = this.setTimer(() => {
      this.timer = undefined
      void this.checkNow()
    }, delayMs)
    this.timer?.unref?.()
  }

  async checkNow() {
    if (!this.enabled || this.checking || this.state.phase === 'downloading' || this.state.phase === 'ready') {
      return false
    }
    if (this.timer !== undefined) this.clearTimer(this.timer)
    this.timer = undefined
    this.checking = true
    this.publish({ phase: 'checking' })
    try {
      await this.updater.checkForUpdates()
      if (this.state.phase === 'checking') {
        this.publish({ phase: 'current' })
        this.schedule(this.intervalMs)
      }
      return true
    } catch (error) {
      this.handleError(error)
      return false
    } finally {
      this.checking = false
    }
  }

  handleError(error) {
    const normalized = error instanceof Error ? error : new Error(String(error))
    this.publish({ phase: 'error', availableVersion: undefined, progress: undefined })
    this.onError(normalized)
    this.schedule(this.intervalMs)
  }

  stop() {
    if (this.timer !== undefined) this.clearTimer(this.timer)
    this.timer = undefined
    if (!this.enabled) return
    this.updater.removeListener('checking-for-update', this.listeners.checking)
    this.updater.removeListener('update-available', this.listeners.available)
    this.updater.removeListener('update-not-available', this.listeners.current)
    this.updater.removeListener('download-progress', this.listeners.progress)
    this.updater.removeListener('update-downloaded', this.listeners.downloaded)
    this.updater.removeListener('error', this.listeners.error)
  }
}

module.exports = { DesktopAppUpdater }
