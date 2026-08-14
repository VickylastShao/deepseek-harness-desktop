'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktopCenter', {
  snapshot: () => ipcRenderer.invoke('desktop-center:snapshot'),
  onSnapshot(callback) {
    const listener = (_event, value) => callback(value)
    ipcRenderer.on('desktop-center:changed', listener)
    return () => ipcRenderer.removeListener('desktop-center:changed', listener)
  },
  setPreference: (key, value) => ipcRenderer.invoke('desktop-center:set-preference', key, value),
  checkHarnessUpdate: () => ipcRenderer.invoke('desktop-center:check-harness-update'),
  checkDesktopUpdate: () => ipcRenderer.invoke('desktop-center:check-desktop-update'),
  restartHarness: () => ipcRenderer.invoke('desktop-center:restart-harness'),
  openDirectory: kind => ipcRenderer.invoke('desktop-center:open-directory', kind),
})
