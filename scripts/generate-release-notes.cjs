'use strict'

const { readFile, writeFile, mkdir } = require('node:fs/promises')
const path = require('node:path')

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u

function artifactNames(version) {
  if (!VERSION_PATTERN.test(version)) throw new Error('Invalid release version.')
  const prefix = `DeepSeek-Harness-Desktop-${version}`
  return {
    windows: [`${prefix}-win-x64.exe`, 'SHA256SUMS-win32-x64.txt'],
    ubuntu: [`${prefix}-linux-amd64.deb`, `${prefix}-linux-x86_64.AppImage`, 'SHA256SUMS-linux-x64.txt'],
    macIntel: [`${prefix}-mac-x64.dmg`, `${prefix}-mac-x64.zip`, 'SHA256SUMS-darwin-x64.txt'],
    macApple: [`${prefix}-mac-arm64.dmg`, `${prefix}-mac-arm64.zip`, 'SHA256SUMS-darwin-arm64.txt'],
  }
}

function generateReleaseNotes(options) {
  const { repository, tag, version } = options
  if (!REPOSITORY_PATTERN.test(repository)) throw new Error('Invalid GitHub repository.')
  if (tag !== `v${version}`) throw new Error(`Release tag ${tag} does not match version ${version}.`)
  const artifacts = artifactNames(version)
  const base = `https://github.com/${repository}/releases/download/${tag}`
  const link = (name, label = name) => `[${label}](${base}/${encodeURIComponent(name)})`
  const changes = typeof options.changes === 'string' && options.changes.trim() !== ''
    ? `\n\n${options.changes.trim()}\n`
    : '\n'
  const prereleaseNotice = options.unsignedPrerelease === true
    ? `\n\n> **Unsigned prerelease:** these installers are not code-signed or notarized.\n> Windows SmartScreen and macOS Gatekeeper may show an unknown-publisher\n> warning. Verify the downloaded file against the linked SHA-256 list.\n`
    : ''
  const signingGuidance = options.unsignedPrerelease === true
    ? `- This prerelease is unsigned. Verify its SHA-256 before installation; do\n  not expect Windows or macOS to display a verified publisher.`
    : `- Tagged production releases pass the repository signing preflight. Verify the\n  displayed publisher on Windows/macOS and compare the file with its SHA-256 list.`

return `# DeepSeek Harness Desktop ${tag}

Run the official DeepSeek Harness Web UI as a self-contained desktop app. No
system-wide Node.js installation or terminal window is required.${prereleaseNotice}

## Direct downloads

| Platform | Recommended package | Alternatives | SHA-256 |
| --- | --- | --- | --- |
| Windows 10/11 x64 | ${link(artifacts.windows[0], 'Setup EXE')} | — | ${link(artifacts.windows[1], 'checksums')} |
| Ubuntu/Debian x64 | ${link(artifacts.ubuntu[0], 'DEB')} | ${link(artifacts.ubuntu[1], 'AppImage')} | ${link(artifacts.ubuntu[2], 'checksums')} |
| macOS Apple Silicon | ${link(artifacts.macApple[0], 'DMG')} | ${link(artifacts.macApple[1], 'ZIP')} | ${link(artifacts.macApple[2], 'checksums')} |
| macOS Intel | ${link(artifacts.macIntel[0], 'DMG')} | ${link(artifacts.macIntel[1], 'ZIP')} | ${link(artifacts.macIntel[2], 'checksums')} |

## Install and update behavior

- The installer includes a platform-native Node.js and verified Harness runtime.
- Launch never waits for a Harness update check. Harness updates download in the
  background and activate only after a later normal restart or quit.
- Installing a newer desktop release preserves the per-user Harness data directory.
${signingGuidance}

## Support bundle

Open **Desktop Control Center → Export diagnostic bundle** to create a bounded,
pattern-redacted archive for an issue report. It copies no Harness session,
credential-store, or workspace files. Review all three included files before
posting it publicly.${changes}`
}

async function main() {
  const [repository, tag, changesPath, outputPath, releaseKind] = process.argv.slice(2)
  if (outputPath === undefined) {
    throw new Error('Usage: generate-release-notes.cjs <owner/repo> <tag> <changes.md> <output.md> [--unsigned-prerelease]')
  }
  if (releaseKind !== undefined && releaseKind !== '--unsigned-prerelease') {
    throw new Error(`Unknown release note option: ${releaseKind}`)
  }
  const projectRoot = path.resolve(__dirname, '..')
  const manifest = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'))
  const changes = await readFile(path.resolve(changesPath), 'utf8')
  const notes = generateReleaseNotes({
    repository,
    tag,
    version: manifest.version,
    changes,
    unsignedPrerelease: releaseKind === '--unsigned-prerelease',
  })
  const target = path.resolve(outputPath)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, notes, 'utf8')
  console.log(`Generated release notes: ${target}`)
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}

module.exports = {
  artifactNames,
  generateReleaseNotes,
}
