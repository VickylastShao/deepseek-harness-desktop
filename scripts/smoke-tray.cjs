'use strict'

const assert = require('node:assert/strict')
const path = require('node:path')
const { readFile } = require('node:fs/promises')
const {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  Tray,
} = require('electron')
const {
  createTrayImage,
  DesktopTrayController,
  trayLabels,
} = require('../src/desktop-tray.cjs')

app.disableHardwareAcceleration()

async function main() {
  await app.whenReady()
  const projectRoot = path.resolve(__dirname, '..')
  const iconBuffer = await readFile(path.join(projectRoot, 'assets', 'tray-icon.png'))
  const window = new BrowserWindow({ width: 480, height: 320, show: false })
  const controller = new DesktopTrayController({
    createTray: icon => new Tray(icon),
    buildMenu: template => Menu.buildFromTemplate(template),
    createNotification: () => ({ show() {} }),
    isNotificationSupported: () => false,
    isQuitting: () => false,
    labels: trayLabels('en-US'),
    logDirectory: app.getPath('logs'),
    onError: error => { throw error },
    onQuit: () => {},
    onRestart: async () => {},
    openPath: async () => '',
    trayIcon: createTrayImage(nativeImage, iconBuffer),
  })

  try {
    controller.initialize(window)
    window.show()
    window.close()
    assert.equal(window.isDestroyed(), false)
    assert.equal(window.isVisible(), false)

    controller.showWindow()
    assert.equal(window.isVisible(), true)
    console.log('System tray close-to-hide and restore smoke test passed.')
  } finally {
    controller.dispose()
    window.destroy()
    app.quit()
  }
}

main().catch(error => {
  console.error(error)
  app.exit(1)
})
