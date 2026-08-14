'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { createDesktopSnapshot, validatePreferenceChange } = require('../src/desktop-center.cjs')

test('desktop center snapshot keeps shell and Harness update channels separate', () => {
  const snapshot = createDesktopSnapshot({
    appVersion: '0.2.0',
    desktopUpdateState: { enabled: true, phase: 'ready', availableVersion: '0.2.1' },
    runtimeLifecycle: { phase: 'running' },
    runtimeUpdateState: { phase: 'prepared', currentVersion: '0.1.0-rc.6', pendingVersion: '0.1.0-rc.7' },
    runtimeProcessState: { running: true, pid: 1234 },
    runtimeIdentity: { source: 'bundled', endpoint: 'http://127.0.0.1:41235' },
    taskMonitorState: { phase: 'connected', runningSessions: 2 },
    recoveryState: { attempts: 1, maxAttempts: 3, pending: false },
    system: { platform: 'linux', arch: 'x64', electron: '43.4.0', node: '24.18.1' },
    diagnosticState: { phase: 'ready', filename: 'diagnostic.tar.gz' },
    preferences: { closeToTray: true, notifications: true, openAtLogin: false },
    loginItemSupported: true,
    dataPath: '/data',
    logPath: '/logs',
  })

  assert.equal(snapshot.desktop.updates.availableVersion, '0.2.1')
  assert.equal(snapshot.harness.updates.pendingVersion, '0.1.0-rc.7')
  assert.equal(snapshot.harness.lifecycle.phase, 'running')
  assert.equal(snapshot.capabilities.loginItem, true)
  assert.equal(snapshot.harness.process.pid, 1234)
  assert.equal(snapshot.harness.monitor.runningSessions, 2)
  assert.equal(snapshot.harness.recovery.maxAttempts, 3)
  assert.equal(snapshot.harness.runtime.source, 'bundled')
  assert.equal(snapshot.system.electron, '43.4.0')
  assert.equal(snapshot.diagnostics.filename, 'diagnostic.tar.gz')
})

test('desktop center accepts only known boolean preference changes', () => {
  assert.deepEqual(validatePreferenceChange('closeToTray', false), { closeToTray: false })
  assert.deepEqual(validatePreferenceChange('openAtLogin', true, { loginItemSupported: true }), { openAtLogin: true })
  assert.throws(() => validatePreferenceChange('unknown', true), /Invalid/u)
  assert.throws(() => validatePreferenceChange('notifications', 'yes'), /Invalid/u)
  assert.throws(() => validatePreferenceChange('openAtLogin', true, { loginItemSupported: false }), /not supported/u)
})
