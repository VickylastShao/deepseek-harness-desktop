'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { suppressDefaultApplicationMenu } = require('../src/application-menu.cjs')

test('the Electron default application menu is suppressed', () => {
  let applicationMenu = { items: ['File', 'Edit', 'View', 'Window'] }
  const menu = {
    setApplicationMenu(value) {
      applicationMenu = value
    },
  }

  suppressDefaultApplicationMenu(menu)

  assert.equal(applicationMenu, null)
})
