'use strict'

const path = require('node:path')
const os = require('node:os')
const { mkdir, mkdtemp, rm, writeFile } = require('node:fs/promises')
const { app, BrowserWindow, ipcMain } = require('electron')
const { HarnessProcess } = require('../src/harness-process.cjs')
const { createDesktopCenterWindowOptions } = require('../src/window-policy.cjs')
const packageManifest = require('../package.json')

const projectRoot = path.resolve(__dirname, '..')
const outputDir = path.join(projectRoot, 'docs', 'images')
const screenshotSize = { width: 1440, height: 900 }
const centerScreenshotSize = { width: 1440, height: 1200 }

app.disableHardwareAcceleration()

function waitForLoad(window) {
  return new Promise((resolve, reject) => {
    window.webContents.once('did-finish-load', resolve)
    window.webContents.once('did-fail-load', (_event, code, description) => {
      reject(new Error(`Page load failed (${code}): ${description}`))
    })
  })
}

async function load(window, target) {
  const loaded = waitForLoad(window)
  if (target instanceof URL) {
    await window.loadURL(target.href)
  } else {
    await window.loadFile(target)
  }
  await loaded
}

async function capture(window, filename) {
  const image = await window.webContents.capturePage()
  await writeFile(path.join(outputDir, filename), image.toPNG())
}

async function fitDocumentHeight(window, maximumHeight = 1_800) {
  const documentHeight = await window.webContents.executeJavaScript(
    'Math.ceil(Math.max(document.body.scrollHeight, document.documentElement.scrollHeight))',
  )
  const [width] = window.getContentSize()
  window.setContentSize(width, Math.min(documentHeight + 2, maximumHeight))
}

async function main() {
  await app.whenReady()
  await mkdir(outputDir, { recursive: true })

  const temporaryHome = await mkdtemp(path.join(os.tmpdir(), 'dsh-readme-'))
  const window = new BrowserWindow({
    ...screenshotSize,
    show: false,
    backgroundColor: '#f5f7fb',
    webPreferences: {
      preload: path.join(projectRoot, 'src', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  const harness = new HarnessProcess({
    runtimeExecutable: path.join(
      projectRoot,
      'node_modules',
      'node',
      'bin',
      process.platform === 'win32' ? 'node.exe' : 'node',
    ),
    binPath: path.join(
      projectRoot,
      'runtime-seed',
      'node_modules',
      '@deepseek-ai',
      'dsh',
      'lib',
      'bin.js',
    ),
    cwd: projectRoot,
    dshHome: path.join(temporaryHome, 'dsh-home'),
  })
  ipcMain.handle('desktop-center:snapshot', () => ({
    desktop: { version: packageManifest.version, updates: { enabled: true, phase: 'current' } },
    harness: {
      lifecycle: { phase: 'running' },
      updates: { phase: 'current', currentVersion: '0.1.0-rc.6' },
      process: { running: true, pid: 41235 },
      monitor: { phase: 'connected', runningSessions: 1 },
      recovery: { attempts: 0, maxAttempts: 3, pending: false },
      runtime: { source: 'bundled', endpoint: 'http://127.0.0.1:41235' },
    },
    system: { platform: process.platform, arch: process.arch, electron: process.versions.electron, node: process.versions.node },
    diagnostics: { phase: 'idle' },
    preferences: { closeToTray: true, notifications: true, openAtLogin: false },
    capabilities: { loginItem: true },
    paths: {
      data: '/home/user/.config/deepseek-harness-desktop',
      logs: '/home/user/.config/deepseek-harness-desktop/logs',
    },
  }))

  try {
    await load(window, path.join(projectRoot, 'src', 'renderer', 'loading.html'))
    await new Promise(resolve => setTimeout(resolve, 500))
    await capture(window, 'desktop-startup.png')
    console.log('Captured docs/images/desktop-startup.png')

    const harnessUrl = new URL(await harness.start())
    await load(window, harnessUrl)
    await new Promise(resolve => setTimeout(resolve, 2_000))
    await capture(window, 'desktop-web-ui.png')
    console.log('Captured docs/images/desktop-web-ui.png')

    const center = new BrowserWindow({
      ...createDesktopCenterWindowOptions(path.join(projectRoot, 'src')),
      ...centerScreenshotSize,
      show: false,
    })
    try {
      await load(center, path.join(projectRoot, 'src', 'renderer', 'desktop-center.html'))
      await new Promise(resolve => setTimeout(resolve, 300))
      await fitDocumentHeight(center)
      await new Promise(resolve => setTimeout(resolve, 100))
      await capture(center, 'desktop-control-center.png')
      console.log('Captured docs/images/desktop-control-center.png')
    } finally {
      center.destroy()
    }
  } finally {
    console.log('Stopping the temporary Harness process...')
    await harness.stop()
    console.log('Harness stopped; cleaning up the temporary profile...')
    window.destroy()
    ipcMain.removeHandler('desktop-center:snapshot')
    await rm(temporaryHome, { recursive: true, force: true })
    app.quit()
  }
}

main().catch((error) => {
  console.error(error)
  app.exit(1)
})
