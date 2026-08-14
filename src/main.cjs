'use strict'

const path = require('node:path')
const { readFileSync } = require('node:fs')
const { mkdir, appendFile } = require('node:fs/promises')
const { app, BrowserWindow, ipcMain, shell } = require('electron')
const { HarnessProcess } = require('./harness-process.cjs')
const { RuntimeBundleUpdater } = require('./runtime-bundle-updater.cjs')
const { RuntimeStore } = require('./runtime-store.cjs')
const {
  createWindowOptions,
  isAllowedRuntimeUrl,
  isSafeExternalUrl,
} = require('./window-policy.cjs')

let mainWindow
let runtimeOrigin
let harnessProcess
let starting = false
let quitting = false
let shutdownStarted = false
let backgroundAbortController
let backgroundUpdatePromise
let backgroundUpdateTimer
let logFile
let logQueue = Promise.resolve()

function bundledNodeTools() {
  const nodePackageDir = app.isPackaged
    ? path.join(process.resourcesPath, 'node-runtime')
    : path.join(app.getAppPath(), 'node_modules', 'node')
  const manifest = JSON.parse(readFileSync(path.join(nodePackageDir, 'package.json'), 'utf8'))
  return {
    executable: path.join(nodePackageDir, 'bin', process.platform === 'win32' ? 'node.exe' : 'node'),
    version: manifest.version,
  }
}

function runtimeChannelUrl() {
  if (process.env.DSH_RUNTIME_CHANNEL_URL !== undefined) {
    return process.env.DSH_RUNTIME_CHANNEL_URL.trim()
  }
  const desktopManifest = JSON.parse(readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf8'))
  return typeof desktopManifest.runtimeChannel === 'string'
    ? desktopManifest.runtimeChannel.trim()
    : ''
}

function writeLog(source, value) {
  if (logFile === undefined) return
  const line = `${new Date().toISOString()} [${source}] ${value}`
  logQueue = logQueue
    .then(() => appendFile(logFile, line.endsWith('\n') ? line : `${line}\n`, 'utf8'))
    .catch(error => console.error('Failed to write desktop log:', error))
}

async function initializeLogging() {
  const logDir = path.join(app.getPath('userData'), 'logs')
  await mkdir(logDir, { recursive: true })
  logFile = path.join(logDir, 'desktop.log')
  writeLog(
    'desktop',
    `launcher ${app.getVersion()}, Electron ${process.versions.electron}, Node ${process.versions.node}\n`,
  )
}

function sendStatus(status) {
  if (mainWindow !== undefined && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('runtime:status', status)
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow(createWindowOptions(__dirname))

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedRuntimeUrl(url, runtimeOrigin)) event.preventDefault()
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())
  await mainWindow.loadFile(path.join(__dirname, 'renderer', 'loading.html'))
  void startRuntime()
}

async function showFailure(error) {
  writeLog('desktop', `${error.stack ?? error.message}\n`)
  runtimeOrigin = undefined
  if (mainWindow === undefined || mainWindow.isDestroyed()) return
  await mainWindow.loadFile(path.join(__dirname, 'renderer', 'loading.html'))
  sendStatus({
    phase: 'error',
    message: '无法启动本机已有的 DeepSeek Harness 运行时。',
    detail: error.message,
  })
}

async function checkForBackgroundUpdate(currentRuntime, nodeTools, runtimeStore) {
  if (backgroundAbortController !== undefined || quitting) return false
  const channelUrl = runtimeChannelUrl()
  if (channelUrl === '') {
    writeLog('updater', 'runtime update channel is not configured\n')
    return true
  }
  backgroundAbortController = new AbortController()
  try {
    const updater = new RuntimeBundleUpdater({
      rootDir: runtimeStore.rootDir,
      runtimeExecutable: nodeTools.executable,
      nodeVersion: nodeTools.version,
      channelUrl,
      signal: backgroundAbortController.signal,
    })
    const update = await updater.prepareLatest(currentRuntime.version, status => {
      writeLog('updater', `${status.phase}: ${status.message}\n`)
    })
    if (update !== undefined && !quitting) {
      await runtimeStore.setPending(update)
      writeLog('updater', `staged ${update.version} for the next restart\n`)
      return true
    }
  } catch (error) {
    if (!quitting) writeLog('updater', `background update failed: ${error.stack ?? error.message}\n`)
  } finally {
    backgroundAbortController = undefined
  }
  return false
}

function updateDelayFromEnvironment(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? String(fallback), 10)
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function scheduleBackgroundUpdate(currentRuntime, nodeTools, runtimeStore, delayMs) {
  if (quitting || backgroundUpdateTimer !== undefined) return
  backgroundUpdateTimer = setTimeout(() => {
    backgroundUpdateTimer = undefined
    const cycle = checkForBackgroundUpdate(currentRuntime, nodeTools, runtimeStore)
    backgroundUpdatePromise = cycle
    void cycle.then(staged => {
      if (!staged && !quitting) {
        scheduleBackgroundUpdate(
          currentRuntime,
          nodeTools,
          runtimeStore,
          updateDelayFromEnvironment('DSH_UPDATE_INTERVAL_MS', 6 * 60 * 60_000),
        )
      }
    }).finally(() => {
      if (backgroundUpdatePromise === cycle) backgroundUpdatePromise = undefined
    })
  }, delayMs)
  backgroundUpdateTimer.unref()
}

async function handleUnexpectedExit(result) {
  if (quitting) return
  harnessProcess = undefined
  const reason = `Harness unexpectedly exited (${result.code ?? result.signal ?? 'unknown'}).`
  await showFailure(new Error(result.detail === '' ? reason : `${reason}\n${result.detail}`))
}

async function startRuntime() {
  if (starting || quitting || mainWindow === undefined || mainWindow.isDestroyed()) return
  starting = true
  runtimeOrigin = undefined

  try {
    await mainWindow.loadFile(path.join(__dirname, 'renderer', 'loading.html'))
    const nodeTools = bundledNodeTools()
    const runtimeRoot = path.join(app.getPath('userData'), 'harness-runtime')
    const runtimeStore = new RuntimeStore({
      rootDir: runtimeRoot,
      seedDir: process.env.DSH_RUNTIME_SEED
        ?? path.join(process.resourcesPath, 'runtime-seed'),
      nodeVersion: nodeTools.version,
    })
    sendStatus({ phase: 'starting', message: '正在启动 DeepSeek Harness……' })
    const runtime = await runtimeStore.resolveStartupRuntime()
    if (quitting) return

    sendStatus({ phase: 'starting', message: `正在启动 DeepSeek Harness ${runtime.version}……` })
    const processController = new HarnessProcess({
      runtimeExecutable: nodeTools.executable,
      binPath: runtime.binPath,
      cwd: process.env.DSH_DESKTOP_WORKSPACE ?? app.getPath('home'),
      dshHome: path.join(app.getPath('userData'), 'dsh-home'),
      onLog: (source, value) => writeLog(`harness:${source}`, value),
      onUnexpectedExit: result => { void handleUnexpectedExit(result) },
    })
    harnessProcess = processController
    const url = await processController.start()
    if (quitting || mainWindow.isDestroyed()) {
      await processController.stop()
      return
    }

    runtimeOrigin = new URL(url).origin
    writeLog('desktop', `loading ${runtimeOrigin}\n`)
    await mainWindow.loadURL(url)
    scheduleBackgroundUpdate(
      runtime,
      nodeTools,
      runtimeStore,
      updateDelayFromEnvironment('DSH_UPDATE_DELAY_MS', 30_000),
    )
  } catch (error) {
    const failedProcess = harnessProcess
    harnessProcess = undefined
    await failedProcess?.stop()
    if (!quitting) await showFailure(error instanceof Error ? error : new Error(String(error)))
  } finally {
    starting = false
  }
}

const hasLock = app.requestSingleInstanceLock()
if (!hasLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow === undefined) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(async () => {
    await initializeLogging()
    await createWindow()
  }).catch((error) => {
    console.error(error)
    app.exit(1)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })

  app.on('window-all-closed', () => app.quit())

  app.on('before-quit', (event) => {
    quitting = true
    clearTimeout(backgroundUpdateTimer)
    backgroundUpdateTimer = undefined
    backgroundAbortController?.abort(new Error('Application is shutting down.'))
    if (shutdownStarted || (harnessProcess === undefined && backgroundUpdatePromise === undefined)) return
    event.preventDefault()
    shutdownStarted = true
    void Promise.allSettled([
      harnessProcess?.stop(),
      backgroundUpdatePromise,
    ]).finally(() => app.exit(0))
  })
}

ipcMain.on('runtime:retry', () => {
  void startRuntime()
})
