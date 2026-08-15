'use strict'

const path = require('node:path')

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])
const MAIN_SIDEBAR_WIDTH = 280
const TITLEBAR_HEIGHT = 44
const WINDOWS_LINUX_CONTROLS_WIDTH = 138

function isolatedWebPreferences(preload) {
  return {
    ...(preload === undefined ? {} : { preload }),
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
  }
}

function createWindowOptions(baseDir, platform = process.platform) {
  return {
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 640,
    show: false,
    icon: path.join(baseDir, '..', 'assets', 'app-icon.png'),
    backgroundColor: '#121214',
    title: 'DeepSeek Harness',
    titleBarStyle: platform === 'darwin' ? 'hiddenInset' : 'hidden',
    ...(platform === 'darwin'
      ? {}
      : {
          titleBarOverlay: {
            color: '#121214',
            symbolColor: '#c9cbd0',
            height: TITLEBAR_HEIGHT,
          },
        }),
    webPreferences: isolatedWebPreferences(),
  }
}

function createRuntimeViewOptions(baseDir) {
  return {
    webPreferences: isolatedWebPreferences(path.join(baseDir, 'preload.cjs')),
  }
}

function createTitlebarDragViewOptions() {
  return {
    webPreferences: isolatedWebPreferences(),
  }
}

function calculateMainWindowLayout(size, platform = process.platform) {
  const width = Math.max(0, Math.trunc(size[0]))
  const height = Math.max(0, Math.trunc(size[1]))
  const controlsWidth = platform === 'darwin' ? 0 : WINDOWS_LINUX_CONTROLS_WIDTH
  return {
    runtime: { x: 0, y: 0, width, height },
    titlebarDrag: {
      x: MAIN_SIDEBAR_WIDTH,
      y: 0,
      width: Math.max(0, width - MAIN_SIDEBAR_WIDTH - controlsWidth),
      height: Math.min(TITLEBAR_HEIGHT, height),
    },
  }
}

function createDesktopCenterWindowOptions(baseDir) {
  return {
    width: 920,
    height: 760,
    minWidth: 620,
    minHeight: 560,
    show: false,
    icon: path.join(baseDir, '..', 'assets', 'app-icon.png'),
    backgroundColor: '#f4f7fb',
    title: 'DeepSeek Harness Desktop',
    webPreferences: {
      preload: path.join(baseDir, 'desktop-center-preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  }
}

function isAllowedRuntimeUrl(value, runtimeOrigin) {
  try {
    const url = new URL(value)
    if (url.protocol === 'file:') return runtimeOrigin === undefined
    if (url.protocol !== 'http:' || runtimeOrigin === undefined) return false
    return LOOPBACK_HOSTS.has(url.hostname) && url.origin === runtimeOrigin
  } catch {
    return false
  }
}

function isSafeExternalUrl(value) {
  try {
    const protocol = new URL(value).protocol
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

module.exports = {
  calculateMainWindowLayout,
  createDesktopCenterWindowOptions,
  createRuntimeViewOptions,
  createTitlebarDragViewOptions,
  createWindowOptions,
  isAllowedRuntimeUrl,
  isSafeExternalUrl,
}
