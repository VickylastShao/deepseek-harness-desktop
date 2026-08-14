'use strict'

const path = require('node:path')
const os = require('node:os')
const { mkdir, mkdtemp, rm, writeFile } = require('node:fs/promises')
const { app, BrowserWindow } = require('electron')
const { HarnessProcess } = require('../src/harness-process.cjs')

const projectRoot = path.resolve(__dirname, '..')
const outputDir = path.join(projectRoot, 'docs', 'images')
const screenshotSize = { width: 1440, height: 900 }

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
  } finally {
    console.log('Stopping the temporary Harness process...')
    await harness.stop()
    console.log('Harness stopped; cleaning up the temporary profile...')
    window.destroy()
    await rm(temporaryHome, { recursive: true, force: true })
    app.quit()
  }
}

main().catch((error) => {
  console.error(error)
  app.exit(1)
})
