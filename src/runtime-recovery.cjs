'use strict'

const DEFAULT_DELAYS_MS = Object.freeze([1_000, 5_000, 15_000])

class RuntimeRecoveryController {
  constructor(options) {
    this.restart = options.restart
    this.onScheduled = options.onScheduled ?? (() => {})
    this.onExhausted = options.onExhausted ?? (() => {})
    this.delaysMs = options.delaysMs ?? DEFAULT_DELAYS_MS
    this.windowMs = options.windowMs ?? 5 * 60_000
    this.now = options.now ?? Date.now
    this.setTimer = options.setTimer ?? setTimeout
    this.clearTimer = options.clearTimer ?? clearTimeout
    this.attempts = []
    this.timer = undefined
  }

  handleUnexpectedExit(error) {
    if (this.timer !== undefined) return false
    const now = this.now()
    this.attempts = this.attempts.filter(timestamp => now - timestamp < this.windowMs)
    if (this.attempts.length >= this.delaysMs.length) {
      this.onExhausted({ attempts: this.attempts.length, error })
      return false
    }

    this.attempts.push(now)
    const attempt = this.attempts.length
    const delayMs = this.delaysMs[attempt - 1]
    this.onScheduled({ attempt, delayMs, error })
    this.timer = this.setTimer(() => {
      this.timer = undefined
      void this.restart()
    }, delayMs)
    this.timer?.unref?.()
    return true
  }

  reset() {
    this.cancel()
    this.attempts = []
  }

  cancel() {
    if (this.timer !== undefined) this.clearTimer(this.timer)
    this.timer = undefined
  }
}

module.exports = {
  DEFAULT_DELAYS_MS,
  RuntimeRecoveryController,
}
