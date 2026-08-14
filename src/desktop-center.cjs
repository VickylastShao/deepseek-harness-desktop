'use strict'

const PREFERENCE_KEYS = new Set(['closeToTray', 'notifications', 'openAtLogin'])

function validatePreferenceChange(key, value, options = {}) {
  if (!PREFERENCE_KEYS.has(key) || typeof value !== 'boolean') {
    throw new Error('Invalid desktop preference change.')
  }
  if (key === 'openAtLogin' && options.loginItemSupported !== true) {
    throw new Error('Login startup is not supported on this platform.')
  }
  return { [key]: value }
}

function createDesktopSnapshot(options) {
  return {
    desktop: {
      version: options.appVersion,
      updates: { enabled: false, phase: 'disabled', ...options.desktopUpdateState },
    },
    harness: {
      lifecycle: { phase: 'starting', ...options.runtimeLifecycle },
      updates: { phase: 'idle', ...options.runtimeUpdateState },
    },
    preferences: { ...options.preferences },
    capabilities: { loginItem: options.loginItemSupported === true },
    paths: { data: options.dataPath, logs: options.logPath },
  }
}

module.exports = {
  createDesktopSnapshot,
  PREFERENCE_KEYS,
  validatePreferenceChange,
}
