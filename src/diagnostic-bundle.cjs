'use strict'

const { open, mkdir, mkdtemp, rm, writeFile } = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const tar = require('tar')

const DEFAULT_MAX_LOG_BYTES = 256 * 1024
const SUPPORT_FILES = Object.freeze(['README.txt', 'desktop.log', 'diagnostic-report.json'])

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function redactDiagnosticText(value, options = {}) {
  let result = String(value)
  const paths = [...(options.paths ?? [])]
    .filter(entry => typeof entry?.value === 'string' && entry.value.length > 0)
    .sort((left, right) => right.value.length - left.value.length)
  for (const entry of paths) {
    const rawVariants = new Set([entry.value, entry.value.replaceAll('\\', '/')])
    const variants = new Set()
    for (const value of rawVariants) {
      variants.add(value)
      variants.add(JSON.stringify(value).slice(1, -1))
    }
    for (const value of [...variants].filter(Boolean).sort((left, right) => right.length - left.length)) {
      result = result.replace(
        new RegExp(escapeRegExp(value), process.platform === 'win32' ? 'giu' : 'gu'),
        () => entry.replacement ?? '<PRIVATE_PATH>',
      )
    }
  }

  result = result
    .replace(/-----BEGIN ([A-Z0-9 ]*PRIVATE KEY)-----[\s\S]*?-----END \1-----/gu, '<REDACTED_PRIVATE_KEY>')
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/giu, '$1<REDACTED>@')
    .replace(/([?&](?:api[_-]?key|token|secret|password|authorization)=)[^&#\s]+/giu, '$1<REDACTED>')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/giu, '$1<REDACTED>')
    .replace(
      /(["'](?:api[_-]?key|token|secret|password|authorization)["']\s*:\s*)("[^"\r\n]*"|'[^'\r\n]*'|[^,\s}\r\n]+)/giu,
      (_match, prefix, secret) => `${prefix}${secret.startsWith('"') ? '"<REDACTED>"' : secret.startsWith("'") ? "'<REDACTED>'" : '<REDACTED>'}`,
    )
    .replace(
      /(\b[A-Z0-9_]*(?:API[_-]?KEY|APIKEY|TOKEN|SECRET|PASSWORD|AUTHORIZATION)[A-Z0-9_]*\s*=\s*)([^\s\r\n]+)/giu,
      '$1<REDACTED>',
    )
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/gu, '<REDACTED>')
    .replace(/\bgh[pousr]_[A-Za-z0-9]{20,}\b/gu, '<REDACTED>')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, '<REDACTED>')
  return result
}

async function readFileTail(filename, maxBytes) {
  const handle = await open(filename, 'r')
  try {
    const stat = await handle.stat()
    const bytes = Math.min(stat.size, maxBytes)
    const buffer = Buffer.alloc(bytes)
    await handle.read(buffer, 0, bytes, stat.size - bytes)
    const prefix = stat.size > bytes
      ? `[truncated to the last ${bytes} bytes]\n`
      : ''
    return `${prefix}${buffer.toString('utf8')}`
  } finally {
    await handle.close()
  }
}

async function createDiagnosticBundle(options) {
  const outputPath = path.resolve(options.outputPath)
  const maxLogBytes = options.maxLogBytes ?? DEFAULT_MAX_LOG_BYTES
  const staging = await mkdtemp(path.join(os.tmpdir(), 'deepseek-harness-diagnostic-'))
  const files = []
  try {
    const report = redactDiagnosticText(`${JSON.stringify(options.report ?? {}, null, 2)}\n`, options.redactions)
    await writeFile(path.join(staging, 'diagnostic-report.json'), report, 'utf8')
    files.push('diagnostic-report.json')

    const logFiles = options.logFiles ?? []
    if (logFiles.length > 0) {
      const log = redactDiagnosticText(
        await readFileTail(logFiles[0], maxLogBytes),
        options.redactions,
      )
      await writeFile(path.join(staging, 'desktop.log'), log, 'utf8')
      files.push('desktop.log')
    } else {
      await writeFile(path.join(staging, 'desktop.log'), 'Desktop log was not available.\n', 'utf8')
      files.push('desktop.log')
    }

    const readme = [
      'DeepSeek Harness Desktop diagnostic bundle',
      '',
      'Contents:',
      '- diagnostic-report.json: allowlisted application and runtime state',
      '- desktop.log: bounded and redacted desktop/Harness log tail',
      '',
      'No Harness session, workspace, or credential-store files are copied into this bundle.',
      'The included log tail is pattern-redacted; review all three files before sharing them publicly.',
      '',
    ].join('\n')
    await writeFile(path.join(staging, 'README.txt'), readme, 'utf8')
    files.push('README.txt')

    files.sort()
    await mkdir(path.dirname(outputPath), { recursive: true })
    await tar.c({
      cwd: staging,
      file: outputPath,
      gzip: true,
      mtime: new Date(0),
      portable: true,
    }, files)
    return { outputPath, files }
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}

module.exports = {
  createDiagnosticBundle,
  DEFAULT_MAX_LOG_BYTES,
  redactDiagnosticText,
  SUPPORT_FILES,
}
