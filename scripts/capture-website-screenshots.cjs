'use strict'

const path = require('node:path')
const { createServer } = require('node:http')
const { mkdir, readFile, writeFile } = require('node:fs/promises')
const { app, BrowserWindow } = require('electron')

const projectRoot = path.resolve(__dirname, '..')
const websiteRoot = path.join(projectRoot, 'docs')
const outputDir = path.join(projectRoot, 'build', 'site-preview')

app.disableHardwareAcceleration()

function startWebsiteServer() {
  const contentTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
  }

  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://127.0.0.1').pathname
      const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1)
      const target = path.resolve(websiteRoot, relativePath)
      if (!target.startsWith(`${websiteRoot}${path.sep}`)) {
        response.writeHead(403).end()
        return
      }
      const content = await readFile(target)
      response.writeHead(200, { 'content-type': contentTypes[path.extname(target)] || 'application/octet-stream' })
      response.end(content)
    } catch {
      response.writeHead(404).end()
    }
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

function createPreviewWindow(size) {
  return new BrowserWindow({
    ...size,
    show: false,
    backgroundColor: '#030811',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
}

async function capture(window, filename, size) {
  window.setContentSize(size.width, size.height)
  await new Promise(resolve => setTimeout(resolve, 300))
  const hasHorizontalOverflow = await window.webContents.executeJavaScript(
    'document.documentElement.scrollWidth > document.documentElement.clientWidth',
  )
  if (hasHorizontalOverflow) {
    throw new Error(`Website has horizontal overflow at ${size.width}x${size.height}`)
  }
  const image = await window.webContents.capturePage()
  await writeFile(path.join(outputDir, filename), image.toPNG())
}

async function main() {
  await app.whenReady()
  await mkdir(outputDir, { recursive: true })
  const server = await startWebsiteServer()
  const websiteUrl = `http://127.0.0.1:${server.address().port}/`
  const window = createPreviewWindow({ width: 1440, height: 960 })
  try {
    await window.loadURL(websiteUrl)
    await window.webContents.executeJavaScript("setLanguage('en')")
    const websiteState = await window.webContents.executeJavaScript(`
      (() => {
        const englishTitle = document.querySelector('h1').textContent
        setLanguage('zh')
        const chineseTitle = document.querySelector('h1').textContent
        setLanguage('en')
        return {
          englishTitle,
          chineseTitle,
          imagesLoaded: [...document.images].every((image) => image.complete && image.naturalWidth > 0),
        }
      })()
    `)
    if (!websiteState.englishTitle.includes('without the terminal') || !websiteState.chineseTitle.includes('不再守着命令行')) {
      throw new Error('Website language switch did not update the hero title')
    }
    if (!websiteState.imagesLoaded) {
      throw new Error('Website preview contains an image that failed to load')
    }
    await capture(window, 'desktop.png', { width: 1440, height: 960 })

    const promptState = await window.webContents.executeJavaScript(`
      (() => {
        document.querySelector('.button-download').click()
        const dialog = document.querySelector('#download-prompt')
        return {
          open: dialog.open,
          title: document.querySelector('#download-prompt-title').textContent,
          activeAction: document.activeElement?.dataset.downloadAction,
        }
      })()
    `)
    if (!promptState.open || !promptState.title.includes('download is ready') || promptState.activeAction !== 'star') {
      throw new Error('Website download prompt did not open with the Star action focused')
    }
    await capture(window, 'download-prompt-desktop.png', { width: 1440, height: 960 })
    await window.webContents.executeJavaScript("document.querySelector('[data-download-action=close]').click()")

    await capture(window, 'mobile.png', { width: 390, height: 844 })
    const mobilePromptState = await window.webContents.executeJavaScript(`
      (() => {
        setLanguage('zh')
        document.querySelector('.button-download').click()
        return {
          open: document.querySelector('#download-prompt').open,
          title: document.querySelector('#download-prompt-title').textContent,
        }
      })()
    `)
    if (!mobilePromptState.open || !mobilePromptState.title.includes('安装包已经准备好了')) {
      throw new Error('Mobile Chinese download prompt did not render')
    }
    await capture(window, 'download-prompt-mobile.png', { width: 390, height: 844 })
  } finally {
    window.destroy()
    server.close()
    app.quit()
  }
}

main().catch((error) => {
  console.error(error)
  app.exit(1)
})
