# DeepSeek Harness Desktop

[![Release](https://img.shields.io/github/v/release/VickylastShao/deepseek-harness-desktop)](https://github.com/VickylastShao/deepseek-harness-desktop/releases/latest)
[![Build](https://github.com/VickylastShao/deepseek-harness-desktop/actions/workflows/build-installers.yml/badge.svg)](https://github.com/VickylastShao/deepseek-harness-desktop/actions/workflows/build-installers.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

English | [简体中文](README.zh-CN.md)

Run DeepSeek Harness like a desktop app. No terminal window, system-wide
Node.js installation, or local native build toolchain is required.

<p align="center">
  <img src="docs/images/desktop-web-ui.png" alt="DeepSeek Harness developer preview running inside DeepSeek Harness Desktop" width="880">
</p>

> [!IMPORTANT]
> This is an unofficial community project, not a DeepSeek product. The upstream
> DeepSeek Harness project is currently a developer preview and may introduce
> breaking changes.

## What is DeepSeek Harness?

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), also known
as `dsh`, is an open-source agent harness developed by DeepSeek. Its default Web
UI lets you connect a model provider, choose a workspace, start sessions, and
review approval-sensitive operations from a browser-based interface.

The agent can work with files, run commands, delegate tasks, and maintain a
plan under the active permission policy. Harness is built on
[Cordis](https://github.com/cordiverse/cordis) around an "everything is a
plugin" architecture: model adapters, tools, persistence, sandbox policies,
the Web UI, and even the agent loop are composed as replaceable plugins.

See the upstream [Web UI guide](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/index.md)
and [architecture documentation](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)
for the authoritative description of Harness itself.

## Why a desktop wrapper?

The official quick-start command is:

```bash
npx @deepseek-ai/dsh web
```

That is ideal for developers, but it requires a terminal, Node.js, npm, and
native dependencies that may need a compiler. DeepSeek Harness Desktop packages
that setup into a conventional application:

| Desktop capability | What it changes for the user |
| --- | --- |
| Self-contained runtime | Ships its own Node.js and platform-native Harness runtime. |
| One-click launch | Starts Harness in the background with no visible terminal. |
| System tray lifecycle | Closing the window keeps Harness running; view/check updates, reopen, restart, view logs, or quit from the tray. |
| Local-only bridge | Loads only the Harness server started on a random `127.0.0.1` port. |
| Staged Harness updates | Downloads and verifies a newer runtime while the current session keeps running. |
| Safe next-launch activation | Switches to the staged runtime on the next normal start, with the bundled runtime kept as a fallback. |
| Desktop app updates | Formal tagged builds download newer shell releases in the background and install them after a normal quit. |
| Bounded crash recovery | Restarts Harness after an unexpected exit with backoff, then stops after repeated failures instead of looping forever. |
| Desktop control center | Shows both update channels, runtime health, preferences, and local-data shortcuts in one native window. |
| Native installers | Produces Windows, Ubuntu, Intel macOS, and Apple Silicon macOS packages. |

## Install

The current release is **v0.2.1**. Use the recommended package for a normal
installation, or open the [latest release](https://github.com/VickylastShao/deepseek-harness-desktop/releases/latest)
for release notes and every asset.

| Platform | Recommended | Alternative | SHA-256 |
| --- | --- | --- | --- |
| Windows 10/11 x64 | [Setup EXE](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.1/DeepSeek-Harness-Desktop-0.2.1-win-x64.exe) | — | [checksums](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.1/SHA256SUMS-win32-x64.txt) |
| Ubuntu/Debian x64 | [DEB](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.1/DeepSeek-Harness-Desktop-0.2.1-linux-amd64.deb) | [AppImage](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.1/DeepSeek-Harness-Desktop-0.2.1-linux-x86_64.AppImage) | [checksums](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.1/SHA256SUMS-linux-x64.txt) |
| macOS Apple Silicon | [DMG](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.1/DeepSeek-Harness-Desktop-0.2.1-mac-arm64.dmg) | [ZIP](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.1/DeepSeek-Harness-Desktop-0.2.1-mac-arm64.zip) | [checksums](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.1/SHA256SUMS-darwin-arm64.txt) |
| macOS Intel | [DMG](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.1/DeepSeek-Harness-Desktop-0.2.1-mac-x64.dmg) | [ZIP](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.1/DeepSeek-Harness-Desktop-0.2.1-mac-x64.zip) | [checksums](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.1/SHA256SUMS-darwin-x64.txt) |

Release `v0.2.1` and earlier builds are unsigned. Windows SmartScreen and macOS
Gatekeeper may show an unknown-publisher warning. The repository now enforces a
signing preflight for future tagged releases; see the
[release signing setup](docs/CODE_SIGNING.md).

To verify a download, compare it with the checksum file for the same platform:

```powershell
Get-FileHash .\DeepSeek-Harness-Desktop-0.2.1-win-x64.exe -Algorithm SHA256
```

```bash
sha256sum DeepSeek-Harness-Desktop-0.2.1-linux-amd64.deb
```

## First launch

1. Install and open **DeepSeek Harness Desktop**.
2. Read and accept the upstream developer-preview notice.
3. Open **Settings → Models** and configure a model provider.
4. Choose the workspace that Harness is allowed to use.
5. Start a new session and describe the task you want the agent to perform.

The desktop app uses your home directory as the initial working directory.
Set `DSH_DESKTOP_WORKSPACE` before launch to choose a different default.

Closing the main window hides it instead of stopping an active Harness session.
The first close shows a native reminder that the app is still running. The tray
shows the active Harness version and an update staged for the next restart. It
can also check immediately, reopen the window, restart Harness, open the log
folder, or quit completely. Starting the app again restores the existing window
rather than launching a second Harness process.

The tray **Preferences** submenu persists close-to-tray and notification choices.
Windows and macOS also expose **Start at Login** through the operating system's
native login-item integration. Defaults remain conservative: close-to-tray and
notifications are enabled; login startup is disabled.

When the window is hidden or minimized, the desktop shell reports a Harness
task that changed from running to finished with a native notification. Clicking
the notification restores the existing window. The same **Desktop
Notifications** preference controls this behavior. A reconnect never invents a
completion event, and the shell does not inspect or modify the Harness Web UI.

If Harness exits unexpectedly after startup, the desktop shell retries after 1,
5, and 15 seconds. A fourth failure inside five minutes opens the failure screen
instead of starting an infinite recovery loop. A manual retry or tray restart
clears that circuit breaker.

## Screenshots

<table>
  <tr>
    <td align="center"><strong>Desktop launcher startup</strong></td>
    <td align="center"><strong>Harness Web UI on first run</strong></td>
  </tr>
  <tr>
    <td><img src="docs/images/desktop-startup.png" alt="DeepSeek Harness Desktop startup screen"></td>
    <td><img src="docs/images/desktop-web-ui.png" alt="DeepSeek Harness developer preview notice in the desktop app"></td>
  </tr>
</table>

These screenshots are captured from the real local Electron pages and bundled
Harness runtime. The repository includes the capture script used to regenerate
them.

<p align="center">
  <img src="docs/images/desktop-control-center.png" alt="DeepSeek Harness Desktop control center showing runtime health, updates, preferences, and local data" width="880">
</p>

Open **Desktop Control Center** from the tray to inspect the desktop and Harness
versions independently, endpoint and process state, task-event connection,
recovery state, and both update channels. It can also restart Harness, change
desktop preferences, and open the application-data and log directories.

**Export diagnostic bundle** creates a bounded, pattern-redacted `.tar.gz`
archive with a structured desktop-state report, the end of the desktop log, and
a contents notice. It copies no Harness session, credential-store, or workspace
files. Review all three files before attaching the archive to a public issue.

## Updates that do not interrupt your session

Launching the app never waits for a network request. Thirty seconds after
Harness starts successfully, the Harness updater checks the runtime channel;
when no update is available, it checks again every six hours.

If a newer Harness runtime is published for the current operating system and
CPU architecture, the app downloads it in the background and verifies:

- HTTPS transport and the declared archive size
- SHA-256 and npm integrity metadata
- the required Node.js version
- the Harness CLI entry point
- the platform-native `node-pty` module

The running process is never replaced. A verified update is staged and becomes
active on the next normal launch. A failed download or integrity check leaves
the current runtime untouched.

Formal tagged packages also check GitHub Releases for a newer **desktop shell**
60 seconds after Harness becomes ready. The platform updater downloads a newer
NSIS, AppImage/DEB, or signed macOS update without interrupting the session. A
downloaded shell update is installed only after the user normally quits the
application; the next launch uses the new version. Development and unsigned
manual builds keep this channel disabled.

## Security and local data

- The renderer has Node.js integration disabled and Chromium context isolation
  enabled.
- The window accepts navigation only to its packaged loading page and the exact
  loopback origin reported by the managed Harness process.
- External links are handed to the system browser and are limited to HTTP or
  HTTPS URLs.
- Harness state, managed runtimes, staged updates, and desktop logs live under
  Electron's per-user application-data directory.
- Choosing **Quit** from the system tray terminates the Harness process tree and
  cancels any in-flight background download.
- Uninstalling the app does not delete user data by default.

See the project's [privacy policy](PRIVACY.md) and
[code signing policy](CODE_SIGNING_POLICY.md) for the release and network-data
boundaries.

## Troubleshooting

- **Installation takes time:** the installer expands Electron, the bundled
  platform-native Node.js runtime, and the verified Harness seed up front. This
  keeps the first application launch independent of a runtime download or
  compilation step.
- **The tray icon is not visible:** check the hidden or overflow area of the
  Windows taskbar, GNOME/KDE panel, or macOS menu bar. Launching the app again
  restores the existing window instead of starting a second process.
- **No task-completion notification appears:** allow notifications for the app,
  keep **Desktop Notifications** enabled, and hide or minimize the main window.
  The app intentionally stays silent while its main window is visible.
- **Harness does not start:** open **Desktop Control Center**, export a
  diagnostic bundle, review its three files, and attach it to a GitHub issue
  with the steps that led to the failure.

## Development

Node.js `24.18.1` is required. Preparing the seed downloads DeepSeek Harness
from the official npm registry and builds its native dependencies for the
current platform.

```bash
npm ci
npm test
npm run smoke:tray
npm run prepare:seed
npm run smoke:harness
npm run dist
```

To regenerate the README screenshots from a graphical desktop session:

```bash
npm run capture:screenshots
```

Generated runtime and installer directories (`runtime-seed/`,
`runtime-release/`, `build/`, and `release/`) are excluded from Git.

## Runtime configuration

| Environment variable | Purpose | Default |
| --- | --- | --- |
| `DSH_RUNTIME_CHANNEL_URL` | Override the HTTPS runtime-channel manifest. | Embedded release channel |
| `DSH_UPDATE_DELAY_MS` | Delay before the first background update check. | `30000` |
| `DSH_UPDATE_INTERVAL_MS` | Interval between later checks when no update is staged. | `21600000` |
| `DSH_DESKTOP_UPDATE_DELAY_MS` | Delay before the desktop shell checks its release channel. | `60000` |
| `DSH_DESKTOP_UPDATE_INTERVAL_MS` | Interval between later desktop shell checks. | `21600000` |
| `DSH_DESKTOP_WORKSPACE` | Initial Harness working directory. | User home directory |
| `DSH_RUNTIME_SEED` | Override the bundled seed for development and testing. | Packaged seed |

## Releases

The GitHub Actions workflow builds and smoke-tests each target on its native
runner. Every tagged release includes installers plus per-platform SHA-256
files. A separate stable
[`runtime-channel`](https://github.com/VickylastShao/deepseek-harness-desktop/releases/tag/runtime-channel)
release contains the integrity-checked runtime manifest and platform archives
used by the background updater.

Tagged releases require macOS Developer ID signing and notarization plus a valid
Windows Authenticode signature. Missing credentials stop the release before any
installer is published. Development and scheduled runtime builds remain
unsigned; configuration details are in [docs/CODE_SIGNING.md](docs/CODE_SIGNING.md).

## License

DeepSeek Harness Desktop is released under the [MIT License](LICENSE).
DeepSeek Harness and other bundled dependencies retain their own licenses; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
