'use strict'

const assert = require('node:assert/strict')
const { access, readFile, stat } = require('node:fs/promises')
const path = require('node:path')
const test = require('node:test')
const { artifactNames } = require('../scripts/generate-release-notes.cjs')
const manifest = require('../package.json')

const projectRoot = path.resolve(__dirname, '..')

test('bilingual READMEs link every current release package and checksum', async () => {
  const documents = await Promise.all([
    readFile(path.join(projectRoot, 'README.md'), 'utf8'),
    readFile(path.join(projectRoot, 'README.zh-CN.md'), 'utf8'),
  ])
  const names = new Set(Object.values(artifactNames(manifest.version)).flat())

  for (const document of documents) {
    for (const name of names) assert.match(document, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'))
    assert.match(document, new RegExp(`v${manifest.version.replaceAll('.', '\\.')}\\b`, 'u'))
  }
})

test('bilingual README local images resolve inside the repository', async () => {
  const documents = await Promise.all([
    readFile(path.join(projectRoot, 'README.md'), 'utf8'),
    readFile(path.join(projectRoot, 'README.zh-CN.md'), 'utf8'),
  ])

  for (const document of documents) {
    const sources = [...document.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gu)]
      .map(match => match[1])
      .filter(source => !/^https?:\/\//u.test(source))

    assert.ok(sources.length > 0)
    for (const source of sources) await access(path.join(projectRoot, source))
  }
})

test('bilingual READMEs lead with a static product hero and a compact animated tour', async () => {
  const documents = [
    {
      content: await readFile(path.join(projectRoot, 'README.md'), 'utf8'),
      downloadHeading: '## Download',
      tourHeading: '## See it in action',
      userGuide: 'docs/USER_GUIDE.md',
      developmentGuide: 'docs/DEVELOPMENT.md',
    },
    {
      content: await readFile(path.join(projectRoot, 'README.zh-CN.md'), 'utf8'),
      downloadHeading: '## 下载',
      tourHeading: '## 实际体验',
      userGuide: 'docs/USER_GUIDE.zh-CN.md',
      developmentGuide: 'docs/DEVELOPMENT.zh-CN.md',
    },
  ]

  for (const { content, developmentGuide, downloadHeading, tourHeading, userGuide } of documents) {
    const heroIndex = content.indexOf('docs/images/deepseek-harness-main.png')
    const tourIndex = content.indexOf('docs/images/desktop-workflow.gif')
    const downloadIndex = content.indexOf(downloadHeading)

    assert.ok(heroIndex >= 0, 'README must include the real Harness session hero')
    assert.ok(tourIndex > heroIndex, 'animated tour must follow the static hero')
    assert.ok(downloadIndex > tourIndex, 'downloads must follow the product story')
    const detailsStart = content.lastIndexOf('<details>', tourIndex)
    const detailsEnd = content.indexOf('</details>', tourIndex)
    assert.ok(detailsStart >= 0 && detailsEnd > tourIndex, 'animated tours longer than five seconds must be user-controlled')
    assert.match(content, new RegExp(tourHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'))
    assert.match(content, new RegExp(userGuide.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'))
    assert.match(content, new RegExp(developmentGuide.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'))
    assert.ok(content.split('\n').length <= 190, 'README should stay scannable; move detail into docs')
  }
})

test('README media matches the published dimensions and size budgets', async () => {
  const gifPath = path.join(projectRoot, 'docs', 'images', 'desktop-workflow.gif')
  const previewPath = path.join(projectRoot, 'docs', 'images', 'social-preview.png')
  const [gif, preview, gifInfo, previewInfo] = await Promise.all([
    readFile(gifPath),
    readFile(previewPath),
    stat(gifPath),
    stat(previewPath),
  ])

  assert.match(gif.subarray(0, 6).toString('ascii'), /^GIF8[79]a$/u)
  assert.deepEqual([gif.readUInt16LE(6), gif.readUInt16LE(8)], [960, 600])
  assert.ok(gifInfo.size <= 5 * 1024 * 1024, 'animated tour must not exceed 5 MiB')

  assert.deepEqual([...preview.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  assert.deepEqual([preview.readUInt32BE(16), preview.readUInt32BE(20)], [1280, 640])
  assert.ok(previewInfo.size < 1024 * 1024, 'social preview must stay below GitHub\'s 1 MiB limit')
})

test('website metadata uses the repository social preview', async () => {
  const website = await readFile(path.join(projectRoot, 'docs', 'index.html'), 'utf8')

  assert.match(website, /property="og:image" content="https:\/\/vickylastshao\.github\.io\/deepseek-harness-desktop\/images\/social-preview\.png"/u)
  assert.match(website, /name="twitter:card" content="summary_large_image"/u)
  assert.match(website, /name="twitter:image:alt" content="[^"]+"/u)
  assert.doesNotMatch(website, /official DeepSeek Harness experience/iu)
})
