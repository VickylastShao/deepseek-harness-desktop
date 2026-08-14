'use strict'

const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const test = require('node:test')
const { TaskCompletionMonitor } = require('../src/task-completion-monitor.cjs')

class FakeWebSocket extends EventEmitter {
  static instances = []
  static OPEN = 1

  constructor(url) {
    super()
    this.url = url
    this.readyState = 0
    FakeWebSocket.instances.push(this)
  }

  addEventListener(name, listener) {
    this.on(name, listener)
  }

  removeEventListener(name, listener) {
    this.off(name, listener)
  }

  open() {
    this.readyState = FakeWebSocket.OPEN
    this.emit('open', {})
  }

  message(value) {
    this.emit('message', { data: JSON.stringify(value) })
  }

  close(code = 1000) {
    this.readyState = 3
    this.emit('close', { code })
  }
}

function envelope(payload) {
  return {
    type: 'server-request',
    rpcId: 'rpc-1',
    method: payload.type,
    payload,
  }
}

function createHarness() {
  FakeWebSocket.instances = []
  const completions = []
  const states = []
  const errors = []
  const timers = []
  const monitor = new TaskCompletionMonitor({
    WebSocketClass: FakeWebSocket,
    origin: 'http://127.0.0.1:41235',
    reconnectDelaysMs: [10, 20],
    setTimer(callback, delayMs) {
      const timer = { callback, delayMs, unref() {} }
      timers.push(timer)
      return timer
    },
    clearTimer(timer) {
      const index = timers.indexOf(timer)
      if (index !== -1) timers.splice(index, 1)
    },
    onCompleted: value => completions.push(value),
    onError: error => errors.push(error),
    onState: state => states.push(state),
  })
  return { completions, errors, monitor, states, timers }
}

test('notifies exactly once for each observed running-to-idle transition', () => {
  const harness = createHarness()
  harness.monitor.start()
  const socket = FakeWebSocket.instances[0]
  socket.open()

  socket.message(envelope({ type: 'host/session-status', sessionId: 'session-abcdef1234', running: false }))
  socket.message(envelope({ type: 'host/session-status', sessionId: 'session-abcdef1234', running: true }))
  socket.message(envelope({ type: 'host/session-status', sessionId: 'session-abcdef1234', running: false }))
  socket.message(envelope({ type: 'host/session-status', sessionId: 'session-abcdef1234', running: false }))

  assert.equal(harness.completions.length, 1)
  assert.equal(harness.completions[0].sessionId, 'session-abcdef1234')
  assert.equal(harness.states.at(-1).runningSessions, 0)
  assert.match(harness.states.at(-1).lastCompletedAt, /^\d{4}-/u)
})

test('ignores malformed, unrelated, and protocol-mismatched frames', () => {
  const harness = createHarness()
  harness.monitor.start()
  const socket = FakeWebSocket.instances[0]
  socket.open()

  socket.emit('message', { data: '{not json' })
  socket.message(envelope({ type: 'host/workspace-changed', workspace: {} }))
  socket.message({ ...envelope({ type: 'host/session-status', sessionId: 's1', running: true }), method: 'wrong' })
  socket.message(envelope({ type: 'host/session-status', sessionId: '', running: true }))

  assert.equal(harness.completions.length, 0)
  assert.equal(harness.errors.length, 0)
  assert.equal(harness.states.at(-1).runningSessions, 0)
})

test('disconnects reconnect with bounded backoff and reset after a successful open', () => {
  const harness = createHarness()
  assert.equal(harness.monitor.start(), true)
  assert.equal(harness.monitor.start(), false)
  const first = FakeWebSocket.instances[0]
  first.open()
  first.close(1006)

  assert.equal(harness.timers.length, 1)
  assert.equal(harness.timers[0].delayMs, 10)
  harness.timers.shift().callback()
  const second = FakeWebSocket.instances[1]
  second.open()
  second.close(1006)

  assert.equal(harness.timers[0].delayMs, 10)
  assert.equal(harness.states.at(-1).phase, 'reconnecting')
})

test('stop closes the socket, cancels reconnects, and clears live sessions', () => {
  const harness = createHarness()
  harness.monitor.start()
  const socket = FakeWebSocket.instances[0]
  socket.open()
  socket.message(envelope({ type: 'host/session-status', sessionId: 's1', running: true }))
  socket.close(1006)
  assert.equal(harness.timers.length, 1)

  harness.monitor.stop()

  assert.equal(harness.timers.length, 0)
  assert.equal(harness.states.at(-1).phase, 'stopped')
  assert.equal(harness.states.at(-1).runningSessions, 0)
})

test('only accepts loopback HTTP origins', () => {
  assert.throws(() => new TaskCompletionMonitor({ origin: 'https://example.com' }), /loopback/u)
  assert.throws(() => new TaskCompletionMonitor({ origin: 'http://192.168.1.5:3080' }), /loopback/u)
})
