'use strict'

const assert = require('node:assert/strict')
const { mkdtemp, readFile } = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const {
  applyLoginItemPreference,
  DesktopPreferencesStore,
  loginItemSupported,
  normalizePreferences,
} = require('../src/desktop-preferences.cjs')

test('desktop preferences use conservative defaults and discard invalid values', () => {
  assert.deepEqual(normalizePreferences(), {
    closeToTray: true,
    notifications: true,
    openAtLogin: false,
  })
  assert.deepEqual(normalizePreferences({ closeToTray: false, notifications: 'yes' }), {
    closeToTray: false,
    notifications: true,
    openAtLogin: false,
  })
})

test('desktop preferences are persisted atomically and reloaded', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-preferences-'))
  const filename = path.join(root, 'nested', 'preferences.json')
  const store = new DesktopPreferencesStore(filename)

  assert.equal((await store.load()).closeToTray, true)
  await store.update({ closeToTray: false, openAtLogin: true })

  const reloaded = await new DesktopPreferencesStore(filename).load()
  assert.deepEqual(reloaded, {
    closeToTray: false,
    notifications: true,
    openAtLogin: true,
  })
  assert.equal(JSON.parse(await readFile(filename, 'utf8')).openAtLogin, true)
})

test('login item integration is explicit about supported platforms', () => {
  const calls = []
  const electronApp = { setLoginItemSettings: value => calls.push(value) }

  assert.equal(loginItemSupported('win32'), true)
  assert.equal(loginItemSupported('darwin'), true)
  assert.equal(loginItemSupported('linux'), false)
  assert.equal(applyLoginItemPreference(electronApp, true, 'linux'), false)
  assert.equal(applyLoginItemPreference(electronApp, true, 'win32'), true)
  assert.deepEqual(calls, [{ openAtLogin: true }])
})
