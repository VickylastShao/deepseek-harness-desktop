'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { restartManagedRuntime } = require('../src/runtime-control.cjs')

test('restart stops the current Harness process before starting a replacement', async () => {
  const events = []
  const current = {
    async stop() {
      events.push('stop')
    },
  }
  let managed = current

  const restarted = await restartManagedRuntime({
    getCurrent: () => managed,
    isQuitting: () => false,
    isStarting: () => false,
    setCurrent: value => {
      managed = value
      events.push('clear')
    },
    start: async () => {
      events.push('start')
    },
  })

  assert.equal(restarted, true)
  assert.equal(managed, undefined)
  assert.deepEqual(events, ['clear', 'stop', 'start'])
})

test('restart is ignored while startup or application shutdown is active', async () => {
  let starts = 0
  const common = {
    getCurrent: () => ({ stop: async () => {} }),
    setCurrent: () => {},
    start: async () => { starts += 1 },
  }

  assert.equal(await restartManagedRuntime({
    ...common,
    isQuitting: () => false,
    isStarting: () => true,
  }), false)
  assert.equal(await restartManagedRuntime({
    ...common,
    isQuitting: () => true,
    isStarting: () => false,
  }), false)
  assert.equal(starts, 0)
})

test('restart does not launch a replacement when shutdown begins during stop', async () => {
  let quitting = false
  let starts = 0

  const restarted = await restartManagedRuntime({
    getCurrent: () => ({
      async stop() {
        quitting = true
      },
    }),
    isQuitting: () => quitting,
    isStarting: () => false,
    setCurrent: () => {},
    start: async () => { starts += 1 },
  })

  assert.equal(restarted, false)
  assert.equal(starts, 0)
})
