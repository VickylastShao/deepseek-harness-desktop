'use strict'

const path = require('node:path')

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

function createWindowOptions(baseDir) {
  return {
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 640,
    show: false,
    icon: path.join(baseDir, '..', 'assets', 'app-icon.png'),
    backgroundColor: '#f5f7fb',
    title: 'DeepSeek Harness',
    webPreferences: {
      preload: path.join(baseDir, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
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
  createDesktopCenterWindowOptions,
  createWindowOptions,
  isAllowedRuntimeUrl,
  isSafeExternalUrl,
}
