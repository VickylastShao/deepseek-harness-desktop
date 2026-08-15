'use strict'

const path = require('node:path')
const {
  calculateMainWindowLayout,
  createRuntimeViewOptions,
  createTitlebarDragViewOptions,
  isAllowedRuntimeUrl,
  isSafeExternalUrl,
} = require('./window-policy.cjs')

function installRuntimeNavigationGuards({ getRuntimeOrigin, openExternal, webContents }) {
  webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void openExternal(url)
    return { action: 'deny' }
  })
  webContents.on('will-navigate', (event, url) => {
    if (!isAllowedRuntimeUrl(url, getRuntimeOrigin())) event.preventDefault()
  })
}

async function createMainWindowSurface({
  baseDir,
  platform = process.platform,
  WebContentsView,
  window,
}) {
  const runtimeView = new WebContentsView(createRuntimeViewOptions(baseDir))
  const titlebarDragView = new WebContentsView(createTitlebarDragViewOptions())
  titlebarDragView.setBackgroundColor('#00000000')

  window.contentView.addChildView(runtimeView)
  window.contentView.addChildView(titlebarDragView)

  const layout = () => {
    const bounds = calculateMainWindowLayout(window.getContentSize(), platform)
    runtimeView.setBounds(bounds.runtime)
    titlebarDragView.setBounds(bounds.titlebarDrag)
  }
  window.on('resize', layout)
  layout()

  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    window.removeListener('resize', layout)
    window.removeListener('closed', closeAfterWindowDestroyed)
    window.contentView.removeChildView(runtimeView)
    window.contentView.removeChildView(titlebarDragView)
    closeView(runtimeView)
    closeView(titlebarDragView)
  }
  const closeAfterWindowDestroyed = () => {
    if (disposed) return
    disposed = true
    closeView(runtimeView)
    closeView(titlebarDragView)
  }
  window.on('closed', closeAfterWindowDestroyed)

  try {
    await titlebarDragView.webContents.loadFile(
      path.join(baseDir, 'renderer', 'titlebar-drag.html'),
    )
  } catch (error) {
    dispose()
    throw error
  }

  return { dispose, runtimeView, titlebarDragView }
}

function closeView(view) {
  if (!view.webContents.isDestroyed()) view.webContents.close()
}

module.exports = { createMainWindowSurface, installRuntimeNavigationGuards }
