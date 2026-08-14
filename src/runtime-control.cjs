'use strict'

async function restartManagedRuntime(options) {
  if (options.isQuitting() || options.isStarting()) return false

  const current = options.getCurrent()
  options.setCurrent(undefined)
  await current?.stop()
  if (options.isQuitting()) return false

  await options.start()
  return true
}

module.exports = {
  restartManagedRuntime,
}
