'use strict'

function suppressDefaultApplicationMenu(menu) {
  menu.setApplicationMenu(null)
}

module.exports = {
  suppressDefaultApplicationMenu,
}
