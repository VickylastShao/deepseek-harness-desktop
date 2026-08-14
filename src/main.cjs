'use strict'

const path = require('node:path')
const { app, BrowserWindow, ipcMain, shell } = require('electron')
const {
  createWindowOptions,
  isAllowedRuntimeUrl,
  isSafeExternalUrl,
} = require('./window-policy.cjs')

let mainWindow
let runtimeOrigin

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
  sendStatus({ phase: 'idle', message: '桌面启动器已就绪。' })
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

  app.whenReady().then(createWindow).catch((error) => {
    console.error(error)
    app.exit(1)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })

  app.on('window-all-closed', () => app.quit())
}

ipcMain.on('runtime:retry', () => {
  sendStatus({ phase: 'idle', message: '重试功能将在运行时切片中启用。' })
})
