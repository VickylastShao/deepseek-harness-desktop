'use strict'

const path = require('node:path')
const { readFileSync } = require('node:fs')
const { mkdir, appendFile } = require('node:fs/promises')
const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  shell,
  Tray,
} = require('electron')
const {
  createTrayImage,
  DesktopTrayController,
  trayLabels,
} = require('./desktop-tray.cjs')
const { DesktopAppUpdater } = require('./desktop-app-updater.cjs')
const {
  applyLoginItemPreference,
  DesktopPreferencesStore,
  loginItemSupported,
} = require('./desktop-preferences.cjs')
const { HarnessProcess } = require('./harness-process.cjs')
const { restartManagedRuntime } = require('./runtime-control.cjs')
const { RuntimeRecoveryController } = require('./runtime-recovery.cjs')
const { RuntimeBundleUpdater } = require('./runtime-bundle-updater.cjs')
const { RuntimeStore } = require('./runtime-store.cjs')
const {
  createWindowOptions,
  isAllowedRuntimeUrl,
  isSafeExternalUrl,
} = require('./window-policy.cjs')

let mainWindow
let trayController
let runtimeOrigin
let harnessProcess
let starting = false
let restarting = false
let quitting = false
let shutdownStarted = false
let backgroundAbortController
let backgroundUpdatePromise
let backgroundUpdateTimer
let activeRuntime
let activeRuntimeStore
let activeNodeTools
let logFile
let logDirectory
let logQueue = Promise.resolve()
let preferences
let preferencesStore
let runtimeRecovery
let desktopAppUpdater

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
  logDirectory = path.join(app.getPath('userData'), 'logs')
  await mkdir(logDirectory, { recursive: true })
  logFile = path.join(logDirectory, 'desktop.log')
  writeLog(
    'desktop',
    `launcher ${app.getVersion()}, Electron ${process.versions.electron}, Node ${process.versions.node}\n`,
  )
}

function initializeTray(window) {
  trayController?.dispose()
  trayController = new DesktopTrayController({
    createTray: icon => new Tray(icon),
    buildMenu: template => Menu.buildFromTemplate(template),
    createNotification: options => new Notification(options),
    isNotificationSupported: () => Notification.isSupported(),
    isQuitting: () => quitting,
    labels: trayLabels(app.getLocale()),
    loginItemSupported: loginItemSupported(),
    logDirectory: logDirectory ?? path.join(app.getPath('userData'), 'logs'),
    onError: error => writeLog('desktop', `${error.stack ?? error.message}\n`),
    onQuit: () => app.quit(),
    onCheckUpdates: () => checkRuntimeUpdateNow(),
    onCheckDesktopUpdates: () => desktopAppUpdater?.checkNow(),
    onPreferenceChange: patch => updatePreferences(patch),
    onRestart: () => restartRuntime(),
    openPath: target => shell.openPath(target),
    trayIcon: createTrayImage(
      nativeImage,
      readFileSync(path.join(app.getAppPath(), 'assets', 'tray-icon.png')),
    ),
    preferences,
  })
  trayController.initialize(window)
  if (desktopAppUpdater !== undefined) {
    trayController.setDesktopUpdateState(desktopAppUpdater.state)
  }
}

function desktopUpdatesEnabled() {
  const manifest = JSON.parse(readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf8'))
  return app.isPackaged && manifest.desktopUpdates === true
}

function initializeDesktopAppUpdater() {
  const enabled = desktopUpdatesEnabled()
  const updater = enabled ? require('electron-updater').autoUpdater : new (require('node:events').EventEmitter)()
  desktopAppUpdater = new DesktopAppUpdater({
    updater,
    enabled,
    currentVersion: app.getVersion(),
    delayMs: updateDelayFromEnvironment('DSH_DESKTOP_UPDATE_DELAY_MS', 60_000),
    intervalMs: updateDelayFromEnvironment('DSH_DESKTOP_UPDATE_INTERVAL_MS', 6 * 60 * 60_000),
    onState: state => trayController?.setDesktopUpdateState(state),
    onError: error => writeLog('desktop-updater', `${error.stack ?? error.message}\n`),
  })
}

async function initializePreferences() {
  preferencesStore = new DesktopPreferencesStore(path.join(app.getPath('userData'), 'preferences.json'))
  preferences = await preferencesStore.load()
  applyLoginItemPreference(app, preferences.openAtLogin)
}

async function updatePreferences(patch) {
  preferences = await preferencesStore.update(patch)
  if (patch.openAtLogin !== undefined) {
    applyLoginItemPreference(app, preferences.openAtLogin)
  }
  return preferences
}

function showMainWindow() {
  if (mainWindow === undefined || mainWindow.isDestroyed()) {
    void createWindow()
    return
  }
  trayController?.showWindow()
}

function sendStatus(status) {
  if (mainWindow !== undefined && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('runtime:status', status)
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow(createWindowOptions(__dirname))
  initializeTray(mainWindow)

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

async function showRecoveryStatus({ attempt, delayMs, error }) {
  writeLog('desktop', `scheduling automatic recovery ${attempt} in ${delayMs} ms\n`)
  runtimeOrigin = undefined
  if (mainWindow === undefined || mainWindow.isDestroyed()) return
  await mainWindow.loadFile(path.join(__dirname, 'renderer', 'loading.html'))
  sendStatus({
    phase: 'starting',
    message: `Harness 意外退出，正在进行第 ${attempt} 次自动恢复……`,
    detail: error.message,
  })
}

function initializeRuntimeRecovery() {
  runtimeRecovery = new RuntimeRecoveryController({
    restart: () => startRuntime(),
    onScheduled: state => { void showRecoveryStatus(state) },
    onExhausted: ({ error }) => { void showFailure(error) },
  })
}

async function checkForBackgroundUpdate(currentRuntime, nodeTools, runtimeStore) {
  if (backgroundAbortController !== undefined || quitting) return false
  const channelUrl = runtimeChannelUrl()
  if (channelUrl === '') {
    writeLog('updater', 'runtime update channel is not configured\n')
    trayController?.setRuntimeUpdateState({
      phase: 'disabled',
      currentVersion: currentRuntime.version,
    })
    return false
  }
  backgroundAbortController = new AbortController()
  trayController?.setRuntimeUpdateState({
    phase: 'checking',
    currentVersion: currentRuntime.version,
  })
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
      trayController?.setRuntimeUpdateState({
        phase: status.phase,
        currentVersion: currentRuntime.version,
      })
    })
    if (update !== undefined && !quitting) {
      await runtimeStore.setPending(update)
      writeLog('updater', `staged ${update.version} for the next restart\n`)
      trayController?.setRuntimeUpdateState({
        phase: 'prepared',
        currentVersion: currentRuntime.version,
        pendingVersion: update.version,
      })
      return true
    }
    trayController?.setRuntimeUpdateState({
      phase: 'current',
      currentVersion: currentRuntime.version,
      pendingVersion: undefined,
    })
  } catch (error) {
    if (!quitting) {
      writeLog('updater', `background update failed: ${error.stack ?? error.message}\n`)
      trayController?.setRuntimeUpdateState({
        phase: 'error',
        currentVersion: currentRuntime.version,
      })
    }
  } finally {
    backgroundAbortController = undefined
  }
  return false
}

async function checkRuntimeUpdateNow() {
  if (activeRuntime === undefined || activeNodeTools === undefined || activeRuntimeStore === undefined) return
  clearTimeout(backgroundUpdateTimer)
  backgroundUpdateTimer = undefined
  const staged = await checkForBackgroundUpdate(activeRuntime, activeNodeTools, activeRuntimeStore)
  if (!staged && !quitting) {
    scheduleBackgroundUpdate(
      activeRuntime,
      activeNodeTools,
      activeRuntimeStore,
      updateDelayFromEnvironment('DSH_UPDATE_INTERVAL_MS', 6 * 60 * 60_000),
    )
  }
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
  const error = new Error(result.detail === '' ? reason : `${reason}\n${result.detail}`)
  writeLog('desktop', `${error.message}\n`)
  runtimeRecovery.handleUnexpectedExit(error)
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
    activeRuntime = runtime
    activeRuntimeStore = runtimeStore
    activeNodeTools = nodeTools
    trayController?.setRuntimeUpdateState({
      phase: 'idle',
      currentVersion: runtime.version,
      pendingVersion: undefined,
    })
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
    desktopAppUpdater?.start()
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

async function restartRuntime() {
  if (restarting) return
  runtimeRecovery?.reset()
  restarting = true
  try {
    await restartManagedRuntime({
      getCurrent: () => harnessProcess,
      isQuitting: () => quitting,
      isStarting: () => starting,
      setCurrent: value => { harnessProcess = value },
      start: () => startRuntime(),
    })
  } finally {
    restarting = false
  }
}

const hasLock = app.requestSingleInstanceLock()
if (!hasLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showMainWindow()
  })

  app.whenReady().then(async () => {
    await initializeLogging()
    await initializePreferences()
    initializeRuntimeRecovery()
    initializeDesktopAppUpdater()
    await createWindow()
  }).catch((error) => {
    console.error(error)
    app.exit(1)
  })

  app.on('activate', () => {
    showMainWindow()
  })

  app.on('before-quit', (event) => {
    quitting = true
    trayController?.dispose()
    trayController = undefined
    clearTimeout(backgroundUpdateTimer)
    backgroundUpdateTimer = undefined
    backgroundAbortController?.abort(new Error('Application is shutting down.'))
    runtimeRecovery?.cancel()
    desktopAppUpdater?.stop()
    if (shutdownStarted || (harnessProcess === undefined && backgroundUpdatePromise === undefined)) return
    event.preventDefault()
    shutdownStarted = true
    void Promise.allSettled([
      harnessProcess?.stop(),
      backgroundUpdatePromise,
    ]).finally(() => app.quit())
  })
}

ipcMain.on('runtime:retry', () => {
  runtimeRecovery?.reset()
  void startRuntime()
})
