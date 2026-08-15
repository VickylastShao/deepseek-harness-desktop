'use strict'

const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { existsSync, readFileSync } = require('node:fs')
const { mkdir, appendFile } = require('node:fs/promises')
const {
  app,
  BaseWindow,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  Notification,
  shell,
  Tray,
  WebContentsView,
} = require('electron')
const { suppressDefaultApplicationMenu } = require('./application-menu.cjs')
const {
  createTrayImage,
  DesktopTrayController,
  trayIconFilename,
  trayLabels,
} = require('./desktop-tray.cjs')
const { DesktopAppUpdater } = require('./desktop-app-updater.cjs')
const { createDesktopSnapshot, validatePreferenceChange } = require('./desktop-center.cjs')
const { createDiagnosticBundle } = require('./diagnostic-bundle.cjs')
const {
  applyLoginItemPreference,
  DesktopPreferencesStore,
  loginItemSupported,
} = require('./desktop-preferences.cjs')
const { HarnessProcess } = require('./harness-process.cjs')
const {
  createMainWindowSurface,
  installRuntimeNavigationGuards,
} = require('./main-window-surface.cjs')
const { restartManagedRuntime } = require('./runtime-control.cjs')
const { RuntimeRecoveryController } = require('./runtime-recovery.cjs')
const { RuntimeBundleUpdater } = require('./runtime-bundle-updater.cjs')
const { prepareBundledRuntime } = require('./bundled-runtime.cjs')
const { RuntimeStore } = require('./runtime-store.cjs')
const { TaskCompletionMonitor } = require('./task-completion-monitor.cjs')
const {
  applyMainWindowAppearance,
  createDesktopCenterWindowOptions,
  createWindowOptions,
} = require('./window-policy.cjs')

suppressDefaultApplicationMenu(Menu)
if (process.platform === 'win32') app.setAppUserModelId('ai.deepseek.harness.desktop')

let mainWindow
let mainSurface
let desktopCenterWindow
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
let desktopUpdateState = { enabled: false, phase: 'disabled' }
let runtimeUpdateState = { phase: 'idle' }
let runtimeLifecycle = { phase: 'starting' }
let taskCompletionMonitor
let taskMonitorState = { phase: 'stopped', runningSessions: 0 }
let diagnosticState = { phase: 'idle' }

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

function currentTrayImage() {
  const isDark = process.platform === 'win32'
    ? nativeTheme.shouldUseDarkColorsForSystemIntegratedUI
    : nativeTheme.shouldUseDarkColors
  return createTrayImage(
    nativeImage,
    readFileSync(path.join(
      app.getAppPath(),
      'assets',
      trayIconFilename(isDark),
    )),
  )
}

function updateTrayArtwork() {
  try {
    trayController?.setIcon(currentTrayImage())
  } catch (error) {
    writeLog('desktop', `Failed to update tray artwork: ${error.stack ?? error.message}\n`)
  }
}

const handleNativeThemeUpdated = () => updateTrayArtwork()

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
    createNotification: options => new Notification({
      ...options,
      icon: path.join(app.getAppPath(), 'assets', 'app-icon.png'),
    }),
    isNotificationSupported: () => Notification.isSupported(),
    isQuitting: () => quitting,
    labels: trayLabels(app.getLocale()),
    loginItemSupported: loginItemSupported(),
    logDirectory: logDirectory ?? path.join(app.getPath('userData'), 'logs'),
    onError: error => writeLog('desktop', `${error.stack ?? error.message}\n`),
    onQuit: () => app.quit(),
    onCheckUpdates: () => checkRuntimeUpdateNow(),
    onCheckDesktopUpdates: () => desktopAppUpdater?.checkNow(),
    onOpenDesktopCenter: () => showDesktopCenter(),
    onPreferenceChange: patch => updatePreferences(patch),
    onRestart: () => restartRuntime(),
    openPath: target => shell.openPath(target),
    trayIcon: currentTrayImage(),
    preferences,
  })
  trayController.initialize(window)
  trayController.setRuntimeUpdateState(runtimeUpdateState)
  trayController.setDesktopUpdateState(desktopUpdateState)
}

function desktopSnapshot() {
  const runtimeSource = activeRuntime === undefined
    ? undefined
    : path.resolve(activeRuntime.rootDir) === path.resolve(activeRuntimeStore?.seedDir ?? '')
      ? 'bundled'
      : 'managed'
  return createDesktopSnapshot({
    appVersion: app.getVersion(),
    desktopUpdateState,
    runtimeLifecycle,
    runtimeUpdateState,
    runtimeProcessState: harnessProcess?.snapshot(),
    runtimeIdentity: {
      version: activeRuntime?.version,
      source: runtimeSource,
      endpoint: runtimeOrigin,
    },
    taskMonitorState,
    recoveryState: runtimeRecovery?.snapshot(),
    system: {
      platform: process.platform,
      arch: process.arch,
      electron: process.versions.electron,
      node: process.versions.node,
      packaged: app.isPackaged,
    },
    diagnosticState,
    preferences,
    loginItemSupported: loginItemSupported(),
    dataPath: app.getPath('userData'),
    logPath: logDirectory ?? path.join(app.getPath('userData'), 'logs'),
  })
}

function broadcastDesktopSnapshot() {
  if (desktopCenterWindow !== undefined && !desktopCenterWindow.isDestroyed()) {
    desktopCenterWindow.webContents.send('desktop-center:changed', desktopSnapshot())
  }
}

function setRuntimeUpdateState(patch) {
  runtimeUpdateState = { ...runtimeUpdateState, ...patch }
  trayController?.setRuntimeUpdateState(runtimeUpdateState)
  broadcastDesktopSnapshot()
}

function setDesktopUpdateState(patch) {
  desktopUpdateState = { ...desktopUpdateState, ...patch }
  trayController?.setDesktopUpdateState(desktopUpdateState)
  broadcastDesktopSnapshot()
}

function setRuntimeLifecycle(patch) {
  runtimeLifecycle = { ...runtimeLifecycle, ...patch }
  broadcastDesktopSnapshot()
}

function setTaskMonitorState(state) {
  taskMonitorState = { ...state }
  broadcastDesktopSnapshot()
}

function setDiagnosticState(patch) {
  diagnosticState = { ...diagnosticState, ...patch }
  broadcastDesktopSnapshot()
}

function diagnosticReport() {
  const snapshot = desktopSnapshot()
  return {
    schema: 1,
    generatedAt: new Date().toISOString(),
    application: {
      version: snapshot.desktop.version,
      platform: snapshot.system.platform,
      arch: snapshot.system.arch,
      electron: snapshot.system.electron,
      node: snapshot.system.node,
      packaged: snapshot.system.packaged,
      locale: app.getLocale(),
    },
    desktopUpdates: snapshot.desktop.updates,
    harness: {
      lifecycle: snapshot.harness.lifecycle,
      updates: snapshot.harness.updates,
      process: snapshot.harness.process,
      monitor: snapshot.harness.monitor,
      recovery: snapshot.harness.recovery,
      runtime: snapshot.harness.runtime,
    },
    preferences: snapshot.preferences,
  }
}

async function exportDiagnosticBundle() {
  if (diagnosticState.phase === 'exporting') return { cancelled: false, busy: true }
  const timestamp = new Date().toISOString().replace(/[:.]/gu, '-')
  const options = {
    title: 'Export DeepSeek Harness Desktop Diagnostics',
    defaultPath: path.join(app.getPath('downloads'), `DeepSeek-Harness-Diagnostic-${timestamp}.tar.gz`),
    filters: [{ name: 'Gzip-compressed tar archive', extensions: ['gz'] }],
  }
  const result = desktopCenterWindow !== undefined && !desktopCenterWindow.isDestroyed()
    ? await dialog.showSaveDialog(desktopCenterWindow, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled || result.filePath === undefined) return { cancelled: true }

  setDiagnosticState({ phase: 'exporting', error: undefined, filename: undefined })
  try {
    await logQueue
    const workspace = process.env.DSH_DESKTOP_WORKSPACE ?? app.getPath('home')
    const bundle = await createDiagnosticBundle({
      outputPath: result.filePath,
      report: diagnosticReport(),
      logFiles: logFile !== undefined && existsSync(logFile) ? [logFile] : [],
      redactions: {
        paths: [
          { value: app.getPath('userData'), replacement: '<APP_DATA>' },
          { value: workspace, replacement: '<WORKSPACE>' },
          { value: app.getPath('home'), replacement: '<HOME>' },
        ],
      },
    })
    const generatedAt = new Date().toISOString()
    setDiagnosticState({
      phase: 'ready',
      filename: path.basename(bundle.outputPath),
      generatedAt,
      error: undefined,
    })
    writeLog('desktop', `exported diagnostic bundle ${path.basename(bundle.outputPath)}\n`)
    return { cancelled: false, filename: path.basename(bundle.outputPath), generatedAt }
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error(String(error))
    setDiagnosticState({ phase: 'error', error: normalized.message })
    writeLog('desktop', `diagnostic export failed: ${normalized.stack ?? normalized.message}\n`)
    throw normalized
  }
}

function stopTaskCompletionMonitor() {
  taskCompletionMonitor?.stop()
  taskCompletionMonitor = undefined
}

function startTaskCompletionMonitor(origin) {
  stopTaskCompletionMonitor()
  try {
    taskCompletionMonitor = new TaskCompletionMonitor({
      origin,
      onCompleted: ({ sessionId }) => {
        writeLog('task-monitor', `session ${sessionId} completed\n`)
        trayController?.showTaskCompletedNotification(sessionId)
      },
      onError: error => writeLog('task-monitor', `${error.message}\n`),
      onState: state => setTaskMonitorState(state),
    })
    taskCompletionMonitor.start()
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error(String(error))
    writeLog('task-monitor', `${normalized.stack ?? normalized.message}\n`)
    setTaskMonitorState({
      phase: 'error',
      runningSessions: 0,
      error: normalized.message,
    })
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
    onState: state => setDesktopUpdateState(state),
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
  broadcastDesktopSnapshot()
  return preferences
}

async function showDesktopCenter() {
  if (desktopCenterWindow !== undefined && !desktopCenterWindow.isDestroyed()) {
    if (desktopCenterWindow.isMinimized()) desktopCenterWindow.restore()
    desktopCenterWindow.show()
    desktopCenterWindow.focus()
    return
  }
  const window = new BrowserWindow(createDesktopCenterWindowOptions(__dirname))
  desktopCenterWindow = window
  const expectedUrl = pathToFileURL(path.join(__dirname, 'renderer', 'desktop-center.html')).href
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== expectedUrl) event.preventDefault()
  })
  window.once('ready-to-show', () => window.show())
  window.on('closed', () => {
    if (desktopCenterWindow === window) desktopCenterWindow = undefined
  })
  await window.loadFile(path.join(__dirname, 'renderer', 'desktop-center.html'))
}

function setMainWindowAppearance(phase) {
  if (mainWindow === undefined || mainWindow.isDestroyed()) return
  applyMainWindowAppearance(mainWindow, phase)
}

function showMainWindow() {
  if (mainWindow === undefined || mainWindow.isDestroyed()) {
    void createWindow()
    return
  }
  trayController?.showWindow()
}

function sendStatus(status) {
  const contents = mainRuntimeWebContents()
  if (contents !== undefined) contents.send('runtime:status', status)
}

function mainRuntimeWebContents() {
  const contents = mainSurface?.runtimeView.webContents
  return contents === undefined || contents.isDestroyed() ? undefined : contents
}

async function createWindow() {
  const window = new BaseWindow(createWindowOptions(__dirname))
  mainWindow = window
  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = undefined
      mainSurface = undefined
    }
  })
  const surface = await createMainWindowSurface({
    baseDir: __dirname,
    WebContentsView,
    window,
  })
  if (window.isDestroyed()) return
  mainSurface = surface
  initializeTray(window)

  const contents = mainRuntimeWebContents()
  if (contents === undefined) throw new Error('Unable to create the Harness runtime view.')

  installRuntimeNavigationGuards({
    getRuntimeOrigin: () => runtimeOrigin,
    openExternal: url => shell.openExternal(url),
    webContents: contents,
  })

  await contents.loadFile(path.join(__dirname, 'renderer', 'loading.html'))
  if (!window.isDestroyed()) window.show()
  void startRuntime()
}

async function showFailure(error) {
  writeLog('desktop', `${error.stack ?? error.message}\n`)
  runtimeOrigin = undefined
  setRuntimeLifecycle({ phase: 'error', error: error.message })
  const contents = mainRuntimeWebContents()
  if (mainWindow === undefined || mainWindow.isDestroyed() || contents === undefined) return
  setMainWindowAppearance('loading')
  await contents.loadFile(path.join(__dirname, 'renderer', 'loading.html'))
  sendStatus({
    phase: 'error',
    message: '无法启动本机已有的 DeepSeek Harness 运行时。',
    detail: error.message,
  })
}

async function showRecoveryStatus({ attempt, delayMs, error }) {
  writeLog('desktop', `scheduling automatic recovery ${attempt} in ${delayMs} ms\n`)
  runtimeOrigin = undefined
  setRuntimeLifecycle({ phase: 'recovering', attempt, error: error.message })
  const contents = mainRuntimeWebContents()
  if (mainWindow === undefined || mainWindow.isDestroyed() || contents === undefined) return
  setMainWindowAppearance('loading')
  await contents.loadFile(path.join(__dirname, 'renderer', 'loading.html'))
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
    setRuntimeUpdateState({
      phase: 'disabled',
      currentVersion: currentRuntime.version,
    })
    return false
  }
  backgroundAbortController = new AbortController()
  setRuntimeUpdateState({
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
      setRuntimeUpdateState({
        phase: status.phase,
        currentVersion: currentRuntime.version,
      })
    })
    if (update !== undefined && !quitting) {
      await runtimeStore.setPending(update)
      writeLog('updater', `staged ${update.version} for the next restart\n`)
      setRuntimeUpdateState({
        phase: 'prepared',
        currentVersion: currentRuntime.version,
        pendingVersion: update.version,
      })
      return true
    }
    setRuntimeUpdateState({
      phase: 'current',
      currentVersion: currentRuntime.version,
      pendingVersion: undefined,
    })
  } catch (error) {
    if (!quitting) {
      writeLog('updater', `background update failed: ${error.stack ?? error.message}\n`)
      setRuntimeUpdateState({
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
  stopTaskCompletionMonitor()
  harnessProcess = undefined
  const reason = `Harness unexpectedly exited (${result.code ?? result.signal ?? 'unknown'}).`
  const error = new Error(result.detail === '' ? reason : `${reason}\n${result.detail}`)
  writeLog('desktop', `${error.message}\n`)
  runtimeRecovery.handleUnexpectedExit(error)
}

async function startRuntime() {
  const contents = mainRuntimeWebContents()
  if (
    starting || quitting || mainWindow === undefined || mainWindow.isDestroyed()
    || contents === undefined
  ) return
  starting = true
  runtimeOrigin = undefined
  setRuntimeLifecycle({ phase: 'starting', error: undefined })

  try {
    setMainWindowAppearance('loading')
    await contents.loadFile(path.join(__dirname, 'renderer', 'loading.html'))
    const nodeTools = bundledNodeTools()
    const runtimeRoot = path.join(app.getPath('userData'), 'harness-runtime')
    const seedDir = process.env.DSH_RUNTIME_SEED
      ?? (app.isPackaged ? undefined : path.join(app.getAppPath(), 'runtime-seed'))
    const runtimeStore = new RuntimeStore({
      rootDir: runtimeRoot,
      seedDir,
      prepareSeed: seedDir === undefined
        ? () => prepareBundledRuntime({
          bundleDir: path.join(process.resourcesPath, 'runtime-bundle'),
          rootDir: runtimeRoot,
          runtimeExecutable: nodeTools.executable,
          nodeVersion: nodeTools.version,
        }, sendStatus)
        : undefined,
      nodeVersion: nodeTools.version,
    })
    sendStatus({ phase: 'starting', message: '正在启动 DeepSeek Harness……' })
    const runtime = await runtimeStore.resolveStartupRuntime()
    activeRuntime = runtime
    activeRuntimeStore = runtimeStore
    activeNodeTools = nodeTools
    setRuntimeUpdateState({
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
    if (quitting || mainWindow.isDestroyed() || contents.isDestroyed()) {
      await processController.stop()
      return
    }

    runtimeOrigin = new URL(url).origin
    writeLog('desktop', `loading ${runtimeOrigin}\n`)
    const loadRuntime = contents.loadURL(url)
    setMainWindowAppearance('runtime')
    await loadRuntime
    setRuntimeLifecycle({ phase: 'running', error: undefined })
    startTaskCompletionMonitor(runtimeOrigin)
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
  stopTaskCompletionMonitor()
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
    nativeTheme.on('updated', handleNativeThemeUpdated)
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
    nativeTheme.removeListener('updated', handleNativeThemeUpdated)
    trayController?.dispose()
    trayController = undefined
    clearTimeout(backgroundUpdateTimer)
    backgroundUpdateTimer = undefined
    backgroundAbortController?.abort(new Error('Application is shutting down.'))
    runtimeRecovery?.cancel()
    stopTaskCompletionMonitor()
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

ipcMain.handle('desktop-center:snapshot', () => desktopSnapshot())

ipcMain.handle('desktop-center:set-preference', async (_event, key, value) => {
  const patch = validatePreferenceChange(key, value, {
    loginItemSupported: loginItemSupported(),
  })
  return updatePreferences(patch)
})

ipcMain.handle('desktop-center:check-harness-update', () => checkRuntimeUpdateNow())
ipcMain.handle('desktop-center:check-desktop-update', () => desktopAppUpdater?.checkNow())
ipcMain.handle('desktop-center:restart-harness', () => restartRuntime())
ipcMain.handle('desktop-center:export-diagnostics', () => exportDiagnosticBundle())

ipcMain.handle('desktop-center:open-directory', async (_event, kind) => {
  const target = kind === 'data'
    ? app.getPath('userData')
    : kind === 'logs'
      ? (logDirectory ?? path.join(app.getPath('userData'), 'logs'))
      : undefined
  if (target === undefined) throw new Error('Unknown desktop directory.')
  const errorMessage = await shell.openPath(target)
  if (errorMessage !== '') throw new Error(errorMessage)
})
