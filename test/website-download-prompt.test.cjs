'use strict'

const assert = require('node:assert/strict')
const { readFile } = require('node:fs/promises')
const path = require('node:path')
const test = require('node:test')
const {
  createDownloadPromptController,
  DOWNLOAD_PROMPT_STORAGE_KEY,
  isPointInsideRect,
  REPOSITORY_URL,
  shouldInterceptDownloadClick,
} = require('../docs/download-prompt.js')

const projectRoot = path.resolve(__dirname, '..')
const installerUrl = 'https://example.test/releases/download/v1/app.exe'

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      values.set(key, String(value))
    },
  }
}

function fixture(initialStorage = {}) {
  const downloads = []
  const openedRepositories = []
  const storage = memoryStorage(initialStorage)
  const controller = createDownloadPromptController({
    storage,
    download: url => downloads.push(url),
    openRepository: url => openedRepositories.push(url),
  })
  return { controller, downloads, openedRepositories, storage }
}

test('first installer request waits for a download choice', () => {
  const { controller, downloads } = fixture()

  assert.equal(controller.requestDownload(installerUrl), true)
  assert.deepEqual(downloads, [])
  assert.equal(controller.hasPendingDownload(), true)
})

test('star choice opens the repository and starts the pending download', () => {
  const { controller, downloads, openedRepositories, storage } = fixture()
  controller.requestDownload(installerUrl)

  assert.equal(controller.chooseStarAndDownload(), true)
  assert.deepEqual(openedRepositories, [REPOSITORY_URL])
  assert.deepEqual(downloads, [installerUrl])
  assert.equal(storage.getItem(DOWNLOAD_PROMPT_STORAGE_KEY), 'seen')
  assert.equal(controller.hasPendingDownload(), false)
})

test('direct choice downloads without opening GitHub and suppresses later prompts', () => {
  const { controller, downloads, openedRepositories, storage } = fixture()
  controller.requestDownload(installerUrl)

  assert.equal(controller.chooseDirectDownload(), true)
  assert.deepEqual(openedRepositories, [])
  assert.deepEqual(downloads, [installerUrl])
  assert.equal(storage.getItem(DOWNLOAD_PROMPT_STORAGE_KEY), 'seen')

  assert.equal(controller.requestDownload(`${installerUrl}?second=1`), false)
  assert.deepEqual(downloads, [installerUrl, `${installerUrl}?second=1`])
})

test('returning visitors with a recorded choice download immediately', () => {
  const { controller, downloads } = fixture({ [DOWNLOAD_PROMPT_STORAGE_KEY]: 'seen' })

  assert.equal(controller.requestDownload(installerUrl), false)
  assert.deepEqual(downloads, [installerUrl])
  assert.equal(controller.hasPendingDownload(), false)
})

test('cancelling clears the pending download without suppressing the next prompt', () => {
  const { controller, downloads, storage } = fixture()
  controller.requestDownload(installerUrl)

  controller.cancel()

  assert.equal(controller.hasPendingDownload(), false)
  assert.deepEqual(downloads, [])
  assert.equal(storage.getItem(DOWNLOAD_PROMPT_STORAGE_KEY), null)
  assert.equal(controller.requestDownload(installerUrl), true)
})

test('controller rejects missing callbacks and invalid download URLs', () => {
  assert.throws(() => createDownloadPromptController(), /download and openRepository/u)
  assert.throws(() => createDownloadPromptController({ download() {}, openRepository: undefined }), /download and openRepository/u)

  const { controller } = fixture()
  assert.throws(() => controller.requestDownload(''), /download URL/u)
  assert.throws(() => controller.requestDownload(undefined), /download URL/u)
})

test('storage failures do not block prompting or downloading', () => {
  const downloads = []
  const storage = {
    getItem() { throw new Error('read denied') },
    setItem() { throw new Error('write denied') },
  }
  const controller = createDownloadPromptController({
    storage,
    download: url => downloads.push(url),
    openRepository() {},
  })

  assert.equal(controller.requestDownload(installerUrl), true)
  assert.equal(controller.chooseDirectDownload(), true)
  assert.deepEqual(downloads, [installerUrl])
})

test('download choices without a pending request are no-ops', () => {
  const { controller, downloads, openedRepositories } = fixture()

  assert.equal(controller.chooseStarAndDownload(), false)
  assert.equal(controller.chooseDirectDownload(), false)
  assert.deepEqual(downloads, [])
  assert.deepEqual(openedRepositories, [])
})

test('a blocked repository popup never prevents the installer download', () => {
  const downloads = []
  const controller = createDownloadPromptController({
    storage: memoryStorage(),
    download: url => downloads.push(url),
    openRepository() { throw new Error('popup blocked') },
  })
  controller.requestDownload(installerUrl)

  assert.throws(() => controller.chooseStarAndDownload(), /popup blocked/u)
  assert.deepEqual(downloads, [installerUrl])
  assert.equal(controller.hasPendingDownload(), false)
})

test('only unmodified primary-button clicks are intercepted', () => {
  assert.equal(shouldInterceptDownloadClick({ button: 0 }), true)
  assert.equal(shouldInterceptDownloadClick({ button: 1 }), false)
  for (const modifier of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) {
    assert.equal(shouldInterceptDownloadClick({ button: 0, [modifier]: true }), false)
  }
})

test('backdrop hit testing distinguishes the dialog surface from its backdrop', () => {
  const bounds = { left: 100, right: 500, top: 80, bottom: 480 }

  assert.equal(isPointInsideRect({ clientX: 300, clientY: 200 }, bounds), true)
  assert.equal(isPointInsideRect({ clientX: 20, clientY: 200 }, bounds), false)
  assert.equal(isPointInsideRect({ clientX: 300, clientY: 700 }, bounds), false)
})

test('website loads the prompt controller before the site integration', async () => {
  const html = await readFile(path.join(projectRoot, 'docs', 'index.html'), 'utf8')
  const siteScript = await readFile(path.join(projectRoot, 'docs', 'site.js'), 'utf8')

  assert.match(html, /<script src="download-prompt\.js"><\/script>\s*<script src="site\.js" defer><\/script>/u)
  assert.match(html, /<dialog[^>]+id="download-prompt"/u)
  assert.match(html, /data-download-action="star"/u)
  assert.match(html, /data-download-action="direct"/u)
  assert.equal([...html.matchAll(/<a class="button button-download(?: secondary-download)?"/gu)].length, 5)
  assert.match(siteScript, /typeof HTMLDialogElement === 'function'/u)
})

test('GitHub Pages runs website behavior tests before uploading the site', async () => {
  const workflow = await readFile(path.join(projectRoot, '.github', 'workflows', 'pages.yml'), 'utf8')
  const testStep = workflow.indexOf('node --test test/website-download-prompt.test.cjs')
  const uploadStep = workflow.indexOf('actions/upload-pages-artifact')

  assert.ok(testStep >= 0)
  assert.ok(uploadStep > testStep)
})
