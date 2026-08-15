'use strict'

;(function exposeDownloadPrompt(root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.DeepSeekHarnessDownloadPrompt = api
})(typeof globalThis === 'object' ? globalThis : this, () => {
  const DOWNLOAD_PROMPT_STORAGE_KEY = 'dsh-desktop-download-prompt-v1'
  const REPOSITORY_URL = 'https://github.com/VickylastShao/deepseek-harness-desktop'

  function shouldInterceptDownloadClick(event) {
    return event?.button === 0
      && !event.metaKey
      && !event.ctrlKey
      && !event.shiftKey
      && !event.altKey
  }

  function isPointInsideRect(event, bounds) {
    return event.clientX >= bounds.left && event.clientX <= bounds.right
      && event.clientY >= bounds.top && event.clientY <= bounds.bottom
  }

  function createDownloadPromptController(options) {
    if (!options || typeof options.download !== 'function' || typeof options.openRepository !== 'function') {
      throw new TypeError('Download prompt requires download and openRepository functions.')
    }

    const storage = options.storage
    let pendingUrl

    function promptWasSeen() {
      try {
        return storage?.getItem(DOWNLOAD_PROMPT_STORAGE_KEY) === 'seen'
      } catch {
        return false
      }
    }

    function rememberPrompt() {
      try {
        storage?.setItem(DOWNLOAD_PROMPT_STORAGE_KEY, 'seen')
      } catch {
        // Storage can be unavailable in privacy modes; downloading must still work.
      }
    }

    function takePendingUrl() {
      const url = pendingUrl
      pendingUrl = undefined
      return url
    }

    return {
      requestDownload(url) {
        if (typeof url !== 'string' || url.length === 0) throw new TypeError('A download URL is required.')
        if (promptWasSeen()) {
          options.download(url)
          return false
        }
        pendingUrl = url
        return true
      },

      chooseStarAndDownload() {
        const url = takePendingUrl()
        if (url === undefined) return false
        rememberPrompt()
        try {
          options.openRepository(REPOSITORY_URL)
        } finally {
          options.download(url)
        }
        return true
      },

      chooseDirectDownload() {
        const url = takePendingUrl()
        if (url === undefined) return false
        rememberPrompt()
        options.download(url)
        return true
      },

      cancel() {
        pendingUrl = undefined
      },

      hasPendingDownload() {
        return pendingUrl !== undefined
      },
    }
  }

  return {
    createDownloadPromptController,
    DOWNLOAD_PROMPT_STORAGE_KEY,
    isPointInsideRect,
    REPOSITORY_URL,
    shouldInterceptDownloadClick,
  }
})
