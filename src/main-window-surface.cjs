'use strict'

const path = require('node:path')
const {
  calculateMainWindowLayout,
  createRuntimeViewOptions,
  createTitlebarDragViewOptions,
} = require('./window-policy.cjs')

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
    closeView(runtimeView)
    closeView(titlebarDragView)
  }
  window.on('closed', dispose)

  await titlebarDragView.webContents.loadFile(
    path.join(baseDir, 'renderer', 'titlebar-drag.html'),
  )

  return { dispose, runtimeView, titlebarDragView }
}

function closeView(view) {
  if (!view.webContents.isDestroyed()) view.webContents.close()
}

module.exports = { createMainWindowSurface }
