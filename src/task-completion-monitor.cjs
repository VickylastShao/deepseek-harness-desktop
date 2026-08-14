'use strict'

const DEFAULT_RECONNECT_DELAYS_MS = Object.freeze([1_000, 5_000, 15_000, 30_000])

function hostEventsUrl(origin) {
  const url = new URL(origin)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.port === '') {
    throw new Error('Task completion monitoring requires a managed loopback HTTP origin.')
  }
  url.protocol = 'ws:'
  url.pathname = '/api/events.host'
  url.search = ''
  url.hash = ''
  return url.href
}

function taskStatusFrame(value) {
  if (value === null || typeof value !== 'object'
    || value.type !== 'server-request'
    || value.method !== 'host/session-status') return undefined
  const payload = value.payload
  if (payload === null || typeof payload !== 'object'
    || payload.type !== 'host/session-status'
    || typeof payload.sessionId !== 'string'
    || payload.sessionId.length === 0
    || typeof payload.running !== 'boolean') return undefined
  return payload
}

function messageText(data) {
  if (typeof data === 'string') return data
  if (Buffer.isBuffer(data)) return data.toString('utf8')
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8')
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8')
  }
  return undefined
}

class TaskCompletionMonitor {
  constructor(options) {
    this.url = hostEventsUrl(options.origin)
    this.WebSocketClass = options.WebSocketClass ?? globalThis.WebSocket
    if (typeof this.WebSocketClass !== 'function') {
      throw new Error('This runtime does not provide WebSocket support.')
    }
    this.reconnectDelaysMs = options.reconnectDelaysMs ?? DEFAULT_RECONNECT_DELAYS_MS
    this.setTimer = options.setTimer ?? setTimeout
    this.clearTimer = options.clearTimer ?? clearTimeout
    this.now = options.now ?? (() => new Date())
    this.onCompleted = options.onCompleted ?? (() => {})
    this.onError = options.onError ?? (() => {})
    this.onState = options.onState ?? (() => {})
    this.active = false
    this.socket = undefined
    this.reconnectTimer = undefined
    this.reconnectAttempt = 0
    this.running = new Set()
    this.lastCompletedAt = undefined
    this.phase = 'stopped'
    this.lastError = undefined
  }

  snapshot() {
    return {
      phase: this.phase,
      runningSessions: this.running.size,
      lastCompletedAt: this.lastCompletedAt,
      error: this.lastError,
    }
  }

  emitState(patch = {}) {
    if (patch.phase !== undefined) this.phase = patch.phase
    if (Object.hasOwn(patch, 'error')) this.lastError = patch.error
    this.onState(this.snapshot())
  }

  start() {
    if (this.active) return false
    this.active = true
    this.reconnectAttempt = 0
    this.running.clear()
    this.connect()
    return true
  }

  connect() {
    if (!this.active) return
    this.emitState({ phase: 'connecting', error: undefined })
    let socket
    try {
      socket = new this.WebSocketClass(this.url)
    } catch (error) {
      this.handleConnectionError(error)
      this.scheduleReconnect()
      return
    }
    this.socket = socket
    socket.addEventListener('open', () => {
      if (!this.active || this.socket !== socket) return
      this.reconnectAttempt = 0
      this.running.clear()
      this.emitState({ phase: 'connected', error: undefined })
    })
    socket.addEventListener('message', event => {
      if (!this.active || this.socket !== socket) return
      this.handleMessage(event.data)
    })
    socket.addEventListener('error', () => {
      if (!this.active || this.socket !== socket) return
      this.handleConnectionError(new Error('Harness task event connection failed.'))
    })
    socket.addEventListener('close', () => {
      if (this.socket === socket) this.socket = undefined
      if (!this.active) return
      this.running.clear()
      this.scheduleReconnect()
    })
  }

  handleConnectionError(error) {
    const normalized = error instanceof Error ? error : new Error(String(error))
    this.emitState({ phase: 'error', error: normalized.message })
    this.onError(normalized)
  }

  handleMessage(data) {
    const text = messageText(data)
    if (text === undefined) return
    let value
    try {
      value = JSON.parse(text)
    } catch {
      return
    }
    const frame = taskStatusFrame(value)
    if (frame === undefined) return
    if (frame.running) {
      this.running.add(frame.sessionId)
      this.emitState()
      return
    }
    if (!this.running.delete(frame.sessionId)) return
    this.lastCompletedAt = this.now().toISOString()
    this.emitState()
    this.onCompleted({
      sessionId: frame.sessionId,
      completedAt: this.lastCompletedAt,
    })
  }

  scheduleReconnect() {
    if (!this.active || this.reconnectTimer !== undefined) return
    const index = Math.min(this.reconnectAttempt, this.reconnectDelaysMs.length - 1)
    const delayMs = this.reconnectDelaysMs[index]
    this.reconnectAttempt += 1
    this.emitState({ phase: 'reconnecting' })
    this.reconnectTimer = this.setTimer(() => {
      this.reconnectTimer = undefined
      this.connect()
    }, delayMs)
    this.reconnectTimer?.unref?.()
  }

  stop() {
    this.active = false
    if (this.reconnectTimer !== undefined) this.clearTimer(this.reconnectTimer)
    this.reconnectTimer = undefined
    const socket = this.socket
    this.socket = undefined
    this.running.clear()
    try {
      socket?.close()
    } catch (error) {
      this.onError(error instanceof Error ? error : new Error(String(error)))
    }
    this.emitState({ phase: 'stopped', error: undefined })
  }
}

module.exports = {
  DEFAULT_RECONNECT_DELAYS_MS,
  hostEventsUrl,
  taskStatusFrame,
  TaskCompletionMonitor,
}
