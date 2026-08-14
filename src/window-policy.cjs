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
  createWindowOptions,
  isAllowedRuntimeUrl,
  isSafeExternalUrl,
}
