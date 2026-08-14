'use strict'

const path = require('node:path')
const { mkdir, readFile, rename, writeFile } = require('node:fs/promises')

const DEFAULT_PREFERENCES = Object.freeze({
  closeToTray: true,
  notifications: true,
  openAtLogin: false,
})

function normalizePreferences(value) {
  return Object.fromEntries(Object.entries(DEFAULT_PREFERENCES).map(([key, fallback]) => [
    key,
    typeof value?.[key] === 'boolean' ? value[key] : fallback,
  ]))
}

class DesktopPreferencesStore {
  constructor(filename) {
    this.filename = filename
    this.value = { ...DEFAULT_PREFERENCES }
  }

  async load() {
    try {
      this.value = normalizePreferences(JSON.parse(await readFile(this.filename, 'utf8')))
    } catch {
      this.value = { ...DEFAULT_PREFERENCES }
    }
    return { ...this.value }
  }

  async update(patch) {
    this.value = normalizePreferences({ ...this.value, ...patch })
    await mkdir(path.dirname(this.filename), { recursive: true })
    const temporary = `${this.filename}.${process.pid}.${Date.now()}.tmp`
    await writeFile(temporary, `${JSON.stringify(this.value, null, 2)}\n`, 'utf8')
    await rename(temporary, this.filename)
    return { ...this.value }
  }
}

function loginItemSupported(platform = process.platform) {
  return platform === 'win32' || platform === 'darwin'
}

function applyLoginItemPreference(electronApp, openAtLogin, platform = process.platform) {
  if (!loginItemSupported(platform)) return false
  electronApp.setLoginItemSettings({ openAtLogin })
  return true
}

module.exports = {
  applyLoginItemPreference,
  DEFAULT_PREFERENCES,
  DesktopPreferencesStore,
  loginItemSupported,
  normalizePreferences,
}
