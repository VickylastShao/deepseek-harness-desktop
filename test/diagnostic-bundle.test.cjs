'use strict'

const assert = require('node:assert/strict')
const { mkdtemp, mkdir, readFile, writeFile } = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const tar = require('tar')
const {
  createDiagnosticBundle,
  redactDiagnosticText,
} = require('../src/diagnostic-bundle.cjs')

test('diagnostic redaction removes known paths and credential-shaped values', () => {
  const githubToken = `ghp_${'a'.repeat(30)}`
  const jwt = ['eyJhbGciOiJIUzI1NiJ9', 'c2VjcmV0', 'c2lnbmF0dXJl'].join('.')
  const value = [
    'workspace=/home/alice/private/project',
    'DEEPSEEK_API_KEY=sk-supersecret123456',
    'Authorization: Bearer abc.def.ghi',
    '"token": "private-token-value"',
    'remote=https://alice:basic-auth-secret@example.com/path?api_key=query-secret',
    `jwt=${jwt}`,
    `github=${githubToken}`,
    '-----BEGIN PRIVATE KEY-----',
    'private-key-material',
    '-----END PRIVATE KEY-----',
  ].join('\n')

  const redacted = redactDiagnosticText(value, {
    paths: [{ value: '/home/alice', replacement: '<HOME>' }],
  })

  assert.doesNotMatch(redacted, /alice|supersecret|abc\.def|private-token|basic-auth-secret|query-secret|c2VjcmV0|ghp_|private-key-material/u)
  assert.ok(!redacted.includes(githubToken))
  assert.match(redacted, /<HOME>\/private\/project/u)
  assert.match(redacted, /DEEPSEEK_API_KEY=<REDACTED>/u)
  assert.match(redacted, /Bearer <REDACTED>/u)
})

test('diagnostic redaction removes Windows paths after JSON escaping', () => {
  const home = 'C:\\Users\\Alice Example'
  const serialized = JSON.stringify({ workspace: `${home}\\private\\project` }, null, 2)
  const redacted = redactDiagnosticText(serialized, {
    paths: [{ value: home, replacement: '<HOME>' }],
  })

  assert.doesNotMatch(redacted, /Alice Example/u)
  assert.match(redacted, /<HOME>\\\\private\\\\project/u)
})

test('diagnostic bundle contains only bounded redacted support files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-diagnostic-test-'))
  const logs = path.join(root, 'logs')
  const extracted = path.join(root, 'extracted')
  const output = path.join(root, 'support', 'deepseek-harness-diagnostic.tar.gz')
  await mkdir(logs, { recursive: true })
  await mkdir(extracted, { recursive: true })
  await writeFile(path.join(logs, 'desktop.log'), [
    `cwd=${path.join(root, 'private-workspace')}`,
    'OPENAI_API_KEY=sk-log-secret-123456789',
    'normal diagnostic line',
  ].join('\n'), 'utf8')

  const result = await createDiagnosticBundle({
    outputPath: output,
    report: {
      generatedAt: '2026-08-15T00:00:00.000Z',
      application: { version: '0.3.0', platform: 'linux', arch: 'x64' },
      harness: { version: '0.1.0-rc.6', workspace: path.join(root, 'private-workspace') },
    },
    logFiles: [path.join(logs, 'desktop.log')],
    redactions: {
      paths: [{ value: root, replacement: '<TEST_ROOT>' }],
    },
  })

  assert.equal(result.outputPath, output)
  assert.deepEqual(result.files, ['README.txt', 'desktop.log', 'diagnostic-report.json'])
  await tar.x({ file: output, cwd: extracted })
  const names = []
  await tar.t({ file: output, onentry: entry => names.push(entry.path) })
  assert.deepEqual(names.sort(), result.files)

  const report = await readFile(path.join(extracted, 'diagnostic-report.json'), 'utf8')
  const log = await readFile(path.join(extracted, 'desktop.log'), 'utf8')
  assert.doesNotMatch(report + log, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'))
  assert.doesNotMatch(report + log, /sk-log-secret/u)
  assert.match(report, /<TEST_ROOT>/u)
  assert.match(log, /normal diagnostic line/u)
})

test('diagnostic log tails are size bounded', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-diagnostic-tail-'))
  const logFile = path.join(root, 'large.log')
  const output = path.join(root, 'bundle.tar.gz')
  await writeFile(logFile, `${'old-line\n'.repeat(50_000)}last-line\n`, 'utf8')

  await createDiagnosticBundle({
    outputPath: output,
    report: {},
    logFiles: [logFile],
    maxLogBytes: 8_192,
  })
  const extracted = path.join(root, 'out')
  await mkdir(extracted)
  await tar.x({ file: output, cwd: extracted })
  const value = await readFile(path.join(extracted, 'desktop.log'), 'utf8')

  assert.ok(Buffer.byteLength(value) <= 8_256)
  assert.match(value, /last-line/u)
  assert.doesNotMatch(value, /^old-line\nold-line\nold-line\n/u)
})
