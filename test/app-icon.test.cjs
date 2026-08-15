'use strict'

const assert = require('node:assert/strict')
const { readFile } = require('node:fs/promises')
const path = require('node:path')
const test = require('node:test')
const yaml = require('js-yaml')

const projectRoot = path.resolve(__dirname, '..')

function pngDimensions(buffer) {
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

test('packaged icon has a black rounded plate while UI and tray artwork follow theme contrast', async () => {
  const [
    svg,
    appPng,
    brandLightPng,
    brandDarkPng,
    trayLightPng,
    trayDarkPng,
    builderYaml,
    loadingHtml,
    centerHtml,
    mainSource,
  ] = await Promise.all([
    readFile(path.join(projectRoot, 'assets', 'app-icon.svg'), 'utf8'),
    readFile(path.join(projectRoot, 'assets', 'app-icon.png')),
    readFile(path.join(projectRoot, 'assets', 'brand-whale-light.png')),
    readFile(path.join(projectRoot, 'assets', 'brand-whale-dark.png')),
    readFile(path.join(projectRoot, 'assets', 'tray-icon-light.png')),
    readFile(path.join(projectRoot, 'assets', 'tray-icon-dark.png')),
    readFile(path.join(projectRoot, 'electron-builder.yml'), 'utf8'),
    readFile(path.join(projectRoot, 'src', 'renderer', 'loading.html'), 'utf8'),
    readFile(path.join(projectRoot, 'src', 'renderer', 'desktop-center.html'), 'utf8'),
    readFile(path.join(projectRoot, 'src', 'main.cjs'), 'utf8'),
  ])
  const config = yaml.load(builderYaml)

  assert.match(svg, /fill="#FFFFFF"/u)
  assert.match(svg, /<rect\b[^>]*rx="208"[^>]*fill="#000000"/u)
  assert.deepEqual(pngDimensions(appPng), { width: 1024, height: 1024 })
  assert.deepEqual(pngDimensions(brandLightPng), { width: 256, height: 256 })
  assert.deepEqual(pngDimensions(brandDarkPng), { width: 256, height: 256 })
  assert.deepEqual(pngDimensions(trayLightPng), { width: 64, height: 64 })
  assert.deepEqual(pngDimensions(trayDarkPng), { width: 64, height: 64 })
  assert.equal(config.win.icon, 'assets/app-icon.svg')
  assert.equal(config.linux.icon, 'assets/app-icon.svg')
  assert.equal(config.mac.icon, 'assets/app-icon.svg')
  assert.match(loadingHtml, /assets\/brand-whale-light\.png/u)
  assert.match(centerHtml, /prefers-color-scheme: dark/u)
  assert.match(centerHtml, /assets\/brand-whale-light\.png/u)
  assert.match(centerHtml, /assets\/brand-whale-dark\.png/u)
  assert.match(mainSource, /setAppUserModelId\('ai\.deepseek\.harness\.desktop'\)/u)
  assert.match(mainSource, /icon: path\.join\(app\.getAppPath\(\), 'assets', 'app-icon\.png'\)/u)
  assert.match(mainSource, /shouldUseDarkColorsForSystemIntegratedUI/u)
  assert.match(mainSource, /nativeTheme\.on\('updated', handleNativeThemeUpdated\)/u)
})
