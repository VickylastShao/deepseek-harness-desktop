'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktopRuntime', {
  onStatus(callback) {
    const listener = (_event, status) => callback(status)
    ipcRenderer.on('runtime:status', listener)
    return () => ipcRenderer.removeListener('runtime:status', listener)
  },
  retry() {
    ipcRenderer.send('runtime:retry')
  },
})
