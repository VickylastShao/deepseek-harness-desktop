# Development and release guide

[简体中文](DEVELOPMENT.zh-CN.md) · [README](../README.md)

## Requirements

- Node.js `24.18.1`
- npm from the lockfile-compatible Node.js distribution
- A graphical desktop session for Electron screenshot and tray smoke tests
- Python 3, Pillow, and CairoSVG only when regenerating README media

Preparing the runtime seed downloads DeepSeek Harness from the official npm
registry and builds its native dependencies for the current platform.

## Common commands

```bash
npm ci
npm test
npm run smoke:tray
npm run prepare:seed
npm run smoke:harness
npm run dist
```

Generated runtime and installer directories (`runtime-seed/`,
`runtime-release/`, `build/`, and `release/`) are excluded from Git.

## Screenshots and README media

Capture application screenshots from a graphical desktop session:

```bash
npm run capture:screenshots
```

The capture script writes the real startup, Harness session, and control-center
screenshots under `docs/images/`.

Regenerate the README animation and social preview from those screenshots:

```bash
python3 -m pip install Pillow==12.2.0 CairoSVG==2.9.0
python3 scripts/generate-readme-media.py
```

Verify that committed media is reproducible without modifying the worktree. The
byte-for-byte check uses the canonical Ubuntu 24.04 CI environment with DejaVu
Sans and Noto Sans CJK; use WSL or the `Verify README media` workflow from other
platforms.

```bash
python3 -m pip install -r docs/media-requirements.txt
python3 scripts/generate-readme-media.py --check
```

The generator enforces these delivery constraints:

- `desktop-workflow.gif`: 960×600 and no larger than 5 MiB;
- `social-preview.png`: 1280×640 and smaller than 1 MiB;
- only the repository's real screenshots and existing SVG artwork are used.

Run `npm test` after regeneration. The README tests verify image paths,
dimensions, file signatures, size budgets, release links, and bilingual structure.

## Runtime configuration

| Environment variable | Purpose | Default |
| --- | --- | --- |
| `DSH_RUNTIME_CHANNEL_URL` | Override the HTTPS Harness runtime-channel manifest. | Embedded release channel |
| `DSH_UPDATE_DELAY_MS` | Delay before the first Harness update check. | `30000` |
| `DSH_UPDATE_INTERVAL_MS` | Interval between later Harness checks. | `21600000` |
| `DSH_DESKTOP_UPDATE_DELAY_MS` | Delay before the first desktop-shell check. | `60000` |
| `DSH_DESKTOP_UPDATE_INTERVAL_MS` | Interval between later desktop checks. | `21600000` |
| `DSH_DESKTOP_WORKSPACE` | Initial Harness working directory. | User home directory |
| `DSH_RUNTIME_SEED` | Override the bundled seed for development and testing. | Packaged seed |

## Release engineering

GitHub Actions builds and smoke-tests every target on a native runner. Tagged
releases publish platform installers and SHA-256 files. The separate
[`runtime-channel`](https://github.com/VickylastShao/deepseek-harness-desktop/releases/tag/runtime-channel)
release contains the verified manifest and archives used by background Harness
updates.

Before a runtime is activated, the application validates transport, size,
SHA-256, npm integrity, Node.js compatibility, the Harness entry point, and the
platform-native terminal dependency. Prepared update metadata describes the
final installer bytes rather than pre-signing artifacts.

Future tagged releases must pass macOS Developer ID signing and notarization
plus Windows Authenticode verification before publication. Manual development
and scheduled runtime builds may remain unsigned. See
[CODE_SIGNING.md](CODE_SIGNING.md) and the repository
[code-signing policy](../CODE_SIGNING_POLICY.md).

## Project boundary

The desktop repository owns the Electron host, process lifecycle, native
integration, update staging, diagnostics, and packaging. DeepSeek Harness owns
the agent runtime, plugins, sessions, models, tools, and Web UI. Avoid patching
or injecting into the upstream UI when a desktop-host solution is available.
