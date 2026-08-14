'use strict'

const status = document.querySelector('#status')
const retry = document.querySelector('#retry')
const detail = document.querySelector('#detail')
const progress = document.querySelector('.progress')

window.desktopRuntime.onStatus((next) => {
  status.textContent = next.message
  const failed = next.phase === 'error'
  retry.hidden = !failed
  progress.hidden = failed
  detail.hidden = next.detail === undefined
  detail.textContent = next.detail ?? ''
})

retry.addEventListener('click', () => {
  retry.hidden = true
  detail.hidden = true
  progress.hidden = false
  window.desktopRuntime.retry()
})
