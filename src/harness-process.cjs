'use strict'

const { spawn } = require('node:child_process')
const { once } = require('node:events')

const READY_PATTERN = /dsh web: (http:\/\/[^\r\n]+)\r?\n/u
const MAX_DIAGNOSTIC_CHARS = 24_000

function parseReadyUrl(text) {
  const match = READY_PATTERN.exec(text)
  if (match === null) return undefined
  const url = new URL(match[1])
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.port === '') {
    throw new Error(`Harness reported an unsafe listening URL: ${url.href}`)
  }
  return url.href
}

function appendDiagnostic(current, chunk) {
  const combined = current + chunk.toString()
  return combined.length > MAX_DIAGNOSTIC_CHARS
    ? combined.slice(-MAX_DIAGNOSTIC_CHARS)
    : combined
}

async function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return true
  return Promise.race([
    once(child, 'exit').then(() => true),
    new Promise(resolve => setTimeout(() => resolve(false), timeoutMs)),
  ])
}

async function terminateProcessTree(child, platform = process.platform) {
  if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) return

  if (platform === 'win32') {
    const taskkill = spawn('taskkill.exe', ['/PID', String(child.pid), '/T'], {
      windowsHide: true,
      stdio: 'ignore',
    })
    await waitForExit(taskkill, 5_000)
    if (await waitForExit(child, 5_000)) return
    const forced = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    })
    await waitForExit(forced, 5_000)
    return
  }

  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch (error) {
    if (error.code !== 'ESRCH') throw error
  }
  if (await waitForExit(child, 6_000)) return
  try {
    process.kill(-child.pid, 'SIGKILL')
  } catch (error) {
    if (error.code !== 'ESRCH') throw error
  }
}

class HarnessProcess {
  constructor(options) {
    this.runtimeExecutable = options.runtimeExecutable
    this.binPath = options.binPath
    this.cwd = options.cwd
    this.dshHome = options.dshHome
    this.spawnProcess = options.spawnProcess ?? spawn
    this.terminateTree = options.terminateTree ?? terminateProcessTree
    this.platform = options.platform ?? process.platform
    this.startTimeoutMs = options.startTimeoutMs ?? 120_000
    this.onLog = options.onLog ?? (() => {})
    this.onUnexpectedExit = options.onUnexpectedExit ?? (() => {})
    this.child = undefined
    this.stopping = false
  }

  start() {
    if (this.child !== undefined) throw new Error('Harness process is already running.')
    this.stopping = false
    const env = {
      ...process.env,
      DSH_HOME: this.dshHome,
      NO_COLOR: '1',
    }
    delete env.ELECTRON_RUN_AS_NODE
    delete env.ELECTRON_NO_ATTACH_CONSOLE
    const child = this.spawnProcess(this.runtimeExecutable, [this.binPath, 'web', '--port', '0'], {
      cwd: this.cwd,
      env,
      windowsHide: true,
      detached: this.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    this.child = child

    return new Promise((resolve, reject) => {
      let settled = false
      let stdout = ''
      let stderr = ''
      const timer = setTimeout(() => {
        fail(new Error(`Harness did not report a ready URL within ${this.startTimeoutMs} ms.`))
      }, this.startTimeoutMs)

      const finish = (url) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(url)
      }

      const fail = (error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        void this.stop()
        const detail = stderr.trim() || stdout.trim()
        reject(new Error(detail === '' ? error.message : `${error.message}\n${detail}`))
      }

      child.stdout.on('data', chunk => {
        const value = chunk.toString()
        stdout = appendDiagnostic(stdout, value)
        this.onLog('stdout', value)
        try {
          const url = parseReadyUrl(stdout)
          if (url !== undefined) finish(url)
        } catch (error) {
          fail(error)
        }
      })
      child.stderr.on('data', chunk => {
        const value = chunk.toString()
        stderr = appendDiagnostic(stderr, value)
        this.onLog('stderr', value)
      })
      child.once('error', error => fail(error))
      child.once('exit', (code, signal) => {
        clearTimeout(timer)
        this.child = undefined
        if (!settled) {
          fail(new Error(`Harness exited before startup completed (exit ${code ?? signal ?? 'unknown'}).`))
        } else if (!this.stopping) {
          this.onUnexpectedExit({ code, signal, detail: stderr.trim() || stdout.trim() })
        }
      })
    })
  }

  async stop() {
    const child = this.child
    if (child === undefined) return
    this.stopping = true
    await this.terminateTree(child, this.platform)
    if (this.child === child) this.child = undefined
  }
}

module.exports = {
  HarnessProcess,
  appendDiagnostic,
  parseReadyUrl,
  terminateProcessTree,
  waitForExit,
}
