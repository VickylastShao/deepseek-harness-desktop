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
      process: { running: false, ...options.runtimeProcessState },
      monitor: { phase: 'stopped', runningSessions: 0, ...options.taskMonitorState },
      recovery: { attempts: 0, maxAttempts: 3, pending: false, ...options.recoveryState },
      runtime: { ...options.runtimeIdentity },
    },
    system: { ...options.system },
    diagnostics: { phase: 'idle', ...options.diagnosticState },
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
