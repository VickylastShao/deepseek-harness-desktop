# DeepSeek Harness Desktop user guide

[简体中文](USER_GUIDE.zh-CN.md) · [README](../README.md)

## Install and first launch

Download the package for your platform from the
[v0.2.4 release](https://github.com/VickylastShao/deepseek-harness-desktop/releases/tag/v0.2.4).
The current installers are unsigned prerelease builds:

- Windows may display Microsoft Defender SmartScreen. Review the publisher warning and checksum before continuing.
- macOS may require **System Settings → Privacy & Security → Open Anyway**.
- Linux AppImage users may need `chmod +x DeepSeek-Harness-Desktop-*.AppImage`.

The installer expands Electron, Node.js, and the verified Harness seed. This can
take longer than a small desktop installer, but it prevents a large dependency
download or compilation step on first launch.

When the application opens:

1. Read and accept the upstream developer-preview notice.
2. Open **Settings → Models** and configure a model provider.
3. Choose the workspace Harness may use.
4. Start a session.

The initial workspace is the user home directory unless
`DSH_DESKTOP_WORKSPACE` is set before launch.

## Window, tray, and notifications

- The main window uses the operating system's native controls without a separate title bar.
- Closing the main window hides it when **Keep running when the window closes** is enabled.
- Starting the app again restores the existing single instance.
- The tray menu can reopen or restart Harness, check updates, open logs, and explicitly quit.
- Windows and macOS expose **Start at Login** when the operating system supports it.
- Task-completion notifications appear only while the main window is hidden or minimized.
- Clicking a task notification restores the existing window.
- **Quit** stops the managed Harness process tree and cancels background downloads.

Unexpected Harness exits retry after 1, 5, and 15 seconds. A fourth failure
within five minutes opens the failure screen instead of retrying forever.

## Background updates

Launching the app never waits for an update request.

| Channel | First check | Later checks | Activation |
| --- | --- | --- | --- |
| Harness runtime | 30 seconds after Harness is ready | Every 6 hours | Staged for the next normal app launch |
| Desktop shell | 60 seconds after Harness is ready in signed release builds | Every 6 hours | Installed after a normal quit and used on the next launch |

Before staging a Harness runtime, the updater verifies HTTPS transport,
declared size, SHA-256, npm integrity metadata, required Node.js version, the
Harness CLI entry point, and the platform-native `node-pty` module. A failed
download or integrity check leaves the active runtime untouched. The bundled
seed remains available as a fallback.

## Control center and diagnostics

The desktop control center separates:

- desktop-shell and Harness versions;
- update state for both channels;
- process health and recovery state;
- task-event connectivity;
- close-to-tray, notifications, and start-at-login preferences;
- logs, local data, and diagnostic export actions.

**Export diagnostic bundle** creates a size-bounded, pattern-redacted `.tar.gz`
containing a structured desktop report, the tail of the desktop log, and a
contents notice. It does not copy Harness sessions, credentials, or workspace
files. Review the bundle before publishing it.

## Local data and security boundary

- Harness state, managed runtimes, staged updates, and desktop logs stay in Electron's per-user application-data directory.
- Uninstalling does not delete user data by default.
- Renderer Node.js integration is disabled and Chromium context isolation is enabled.
- Navigation is restricted to the packaged loading page and the exact managed loopback origin.
- External HTTP and HTTPS links open in the system browser.

See the [privacy policy](../PRIVACY.md) and
[code-signing policy](../CODE_SIGNING_POLICY.md) for the complete boundaries.

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| Installation takes a while | Let the installer finish expanding the bundled runtime. First launch is intentionally kept free of this work. |
| Tray icon is missing | Check the taskbar, desktop-panel, or menu-bar overflow area. Starting the app again restores the existing window. |
| No task-completion notification | Allow operating-system notifications, keep **Desktop Notifications** enabled, and hide or minimize the main window. |
| Harness does not start | Open **Desktop Control Center**, export and review a diagnostic bundle, then attach it to an issue with reproduction steps. |
| An update fails | Continue using the active verified runtime. The app retries during a later background cycle. |

Report desktop-wrapper defects in the
[issue tracker](https://github.com/VickylastShao/deepseek-harness-desktop/issues).
For models, plugins, tools, sessions, or Harness Web UI behavior, consult the
[upstream documentation](https://github.com/deepseek-ai/deepseek-harness/tree/master/docs).
