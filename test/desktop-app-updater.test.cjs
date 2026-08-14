'use strict'

const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const test = require('node:test')
const { DesktopAppUpdater } = require('../src/desktop-app-updater.cjs')

function createHarness(enabled = true) {
  const updater = new EventEmitter()
  const states = []
  const errors = []
  const timers = new Map()
  let nextTimer = 0
  let checks = 0
  updater.checkForUpdates = async () => { checks += 1 }
  const controller = new DesktopAppUpdater({
    updater,
    enabled,
    currentVersion: '0.1.9',
    delayMs: 10,
    intervalMs: 20,
    setTimer: callback => {
      nextTimer += 1
      timers.set(nextTimer, callback)
      return nextTimer
    },
    clearTimer: id => timers.delete(id),
    onState: state => states.push(state),
    onError: error => errors.push(error),
  })
  return { checks: () => checks, controller, errors, states, timers, updater }
}

test('desktop updates stay disabled in development builds', async () => {
  const harness = createHarness(false)

  assert.equal(harness.controller.start(), false)
  assert.equal(await harness.controller.checkNow(), false)
  assert.equal(harness.updater.listenerCount('update-downloaded'), 0)
  assert.equal(harness.states.at(-1).phase, 'disabled')
})

test('desktop update checks begin only after the background delay', async () => {
  const harness = createHarness()

  assert.equal(harness.controller.start(), true)
  assert.equal(harness.controller.start(), false)
  assert.equal(harness.timers.size, 1)
  const callback = harness.timers.values().next().value
  harness.timers.clear()
  callback()
  await Promise.resolve()

  assert.equal(harness.checks(), 1)
  assert.equal(harness.updater.autoDownload, true)
  assert.equal(harness.updater.autoInstallOnAppQuit, true)
  assert.equal(harness.updater.disableDifferentialDownload, true)
})

test('a downloaded desktop update is staged without interrupting the app', () => {
  const harness = createHarness()

  harness.updater.emit('update-available', { version: '0.2.0' })
  harness.updater.emit('download-progress', { percent: 47.5 })
  harness.updater.emit('update-downloaded', { version: '0.2.0' })

  assert.deepEqual(harness.states.at(-1), {
    enabled: true,
    phase: 'ready',
    currentVersion: '0.1.9',
    availableVersion: '0.2.0',
    progress: 100,
  })
  assert.equal(harness.timers.size, 0)
})

test('desktop update errors are isolated and retried later', () => {
  const harness = createHarness()
  harness.updater.emit('update-available', { version: '0.2.0' })

  harness.updater.emit('error', new Error('offline'))

  assert.equal(harness.states.at(-1).phase, 'error')
  assert.equal(harness.states.at(-1).availableVersion, undefined)
  assert.equal(harness.errors[0].message, 'offline')
  assert.equal(harness.timers.size, 1)
})

test('stopping removes updater listeners and pending timers', () => {
  const harness = createHarness()
  harness.controller.start()

  harness.controller.stop()

  assert.equal(harness.timers.size, 0)
  assert.equal(harness.updater.listenerCount('error'), 0)
})
