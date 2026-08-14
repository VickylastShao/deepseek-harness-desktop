'use strict'

const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { PassThrough } = require('node:stream')
const test = require('node:test')
const {
  HarnessProcess,
  appendDiagnostic,
  parseReadyUrl,
} = require('../src/harness-process.cjs')

function fakeChild(pid = 4321) {
  const child = new EventEmitter()
  child.pid = pid
  child.exitCode = null
  child.signalCode = null
  child.stdout = new PassThrough()
  child.stderr = new PassThrough()
  return child
}

test('ready URL parser accepts only an explicit IPv4 loopback port', () => {
  assert.equal(
    parseReadyUrl('booting\ndsh web: http://127.0.0.1:41023\n'),
    'http://127.0.0.1:41023/',
  )
  assert.equal(parseReadyUrl('booting'), undefined)
  assert.throws(() => parseReadyUrl('dsh web: http://0.0.0.0:3080\n'), /unsafe listening URL/)
  assert.throws(() => parseReadyUrl('dsh web: http://example.com:3080\n'), /unsafe listening URL/)
})

test('diagnostics keep only a bounded tail', () => {
  const result = appendDiagnostic('a'.repeat(20_000), 'b'.repeat(20_000))
  assert.equal(result.length, 24_000)
  assert.equal(result.endsWith('b'.repeat(20_000)), true)
})

test('HarnessProcess starts hidden, uses a random port, and resolves chunked output', async () => {
  const child = fakeChild()
  let invocation
  const process = new HarnessProcess({
    runtimeExecutable: '/electron',
    binPath: '/runtime/dsh/lib/bin.js',
    cwd: '/workspace',
    dshHome: '/data/dsh-home',
    platform: 'linux',
    spawnProcess: (command, args, options) => {
      invocation = { command, args, options }
      return child
    },
    terminateTree: async () => {},
  })

  const started = process.start()
  child.stdout.write('dsh web: http://127.0.')
  child.stdout.write('0.1:45678\n')
  assert.equal(await started, 'http://127.0.0.1:45678/')
  assert.equal(invocation.command, '/electron')
  assert.deepEqual(invocation.args, ['/runtime/dsh/lib/bin.js', 'web', '--port', '0'])
  assert.equal(invocation.options.windowsHide, true)
  assert.equal(invocation.options.detached, true)
  assert.equal(invocation.options.env.DSH_HOME, '/data/dsh-home')
  assert.equal(invocation.options.env.ELECTRON_RUN_AS_NODE, undefined)
})

test('early exit rejects startup with captured diagnostics', async () => {
  const child = fakeChild()
  const process = new HarnessProcess({
    runtimeExecutable: '/electron',
    binPath: '/runtime/dsh/lib/bin.js',
    cwd: '/workspace',
    dshHome: '/data/dsh-home',
    spawnProcess: () => child,
    terminateTree: async () => {},
  })
  const started = process.start()
  child.stderr.write('configuration rejected')
  child.exitCode = 1
  child.emit('exit', 1, null)
  await assert.rejects(started, /configuration rejected/)
})

test('stop delegates process-tree cleanup once', async () => {
  const child = fakeChild()
  let terminated
  const process = new HarnessProcess({
    runtimeExecutable: '/electron',
    binPath: '/runtime/dsh/lib/bin.js',
    cwd: '/workspace',
    dshHome: '/data/dsh-home',
    spawnProcess: () => child,
    terminateTree: async value => { terminated = value },
  })
  const started = process.start()
  child.stdout.write('dsh web: http://127.0.0.1:40200\n')
  await started
  await process.stop()
  assert.equal(terminated, child)
})
