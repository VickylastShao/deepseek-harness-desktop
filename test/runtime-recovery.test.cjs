'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { RuntimeRecoveryController } = require('../src/runtime-recovery.cjs')

function createHarness(options = {}) {
  let now = 1_000
  let nextTimer = 0
  const timers = new Map()
  const scheduled = []
  const exhausted = []
  let restarts = 0
  const controller = new RuntimeRecoveryController({
    delaysMs: options.delaysMs ?? [10, 20, 30],
    windowMs: options.windowMs ?? 1_000,
    now: () => now,
    setTimer: callback => {
      nextTimer += 1
      timers.set(nextTimer, callback)
      return nextTimer
    },
    clearTimer: id => timers.delete(id),
    restart: async () => { restarts += 1 },
    onScheduled: value => scheduled.push(value),
    onExhausted: value => exhausted.push(value),
  })
  return {
    advance(value) { now += value },
    controller,
    exhausted,
    restarts: () => restarts,
    runTimer() {
      const [id, callback] = timers.entries().next().value
      timers.delete(id)
      callback()
    },
    scheduled,
    timers,
  }
}

test('unexpected exits are restarted with bounded increasing delays', async () => {
  const harness = createHarness()

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    assert.equal(harness.controller.handleUnexpectedExit(new Error(`exit ${attempt}`)), true)
    assert.equal(harness.scheduled.at(-1).delayMs, [10, 20, 30][attempt - 1])
    harness.runTimer()
    await Promise.resolve()
  }

  assert.equal(harness.restarts(), 3)
  assert.equal(harness.controller.handleUnexpectedExit(new Error('exit 4')), false)
  assert.equal(harness.exhausted.length, 1)
})

test('only one recovery timer can be active', () => {
  const harness = createHarness()

  assert.equal(harness.controller.handleUnexpectedExit(new Error('first')), true)
  assert.equal(harness.controller.handleUnexpectedExit(new Error('duplicate')), false)
  assert.equal(harness.timers.size, 1)
})

test('a stable window restores the first recovery delay', () => {
  const harness = createHarness({ windowMs: 100 })
  harness.controller.handleUnexpectedExit(new Error('first'))
  harness.runTimer()
  harness.advance(101)

  harness.controller.handleUnexpectedExit(new Error('later'))

  assert.equal(harness.scheduled.at(-1).attempt, 1)
  assert.equal(harness.scheduled.at(-1).delayMs, 10)
})

test('manual reset cancels recovery and clears the circuit breaker', () => {
  const harness = createHarness()
  harness.controller.handleUnexpectedExit(new Error('first'))

  harness.controller.reset()

  assert.equal(harness.timers.size, 0)
  assert.equal(harness.controller.handleUnexpectedExit(new Error('manual retry failed')), true)
  assert.equal(harness.scheduled.at(-1).attempt, 1)
})
