# DeepSeek Harness Desktop

[中文说明](README.zh-CN.md)

An unofficial Electron desktop launcher for
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It bundles
a private Node.js runtime and a verified, platform-native Harness runtime, so
end users do not need to keep a terminal open or install a compiler toolchain.

> This community project is not an official DeepSeek product. DeepSeek Harness
> remains the upstream project developed by DeepSeek.

## Runtime updates

Application startup never waits for a network request. Thirty seconds after a
successful launch, the background updater checks the stable runtime channel;
subsequent checks run every six hours. A newer platform-specific runtime is
downloaded, verified, and staged without replacing the current process. The
staged runtime becomes active on the next normal launch, with the bundled seed
available as a fallback.

The verifier checks HTTPS transport, declared size, SHA-256, npm integrity,
Node.js compatibility, the Harness CLI, and the native `node-pty` module.

## Releases

GitHub Actions builds native artifacts on each target platform:

- Windows x64: NSIS `.exe`
- Ubuntu x64: `.AppImage` and `.deb`
- macOS Intel: x64 `.dmg` and `.zip`
- macOS Apple Silicon: arm64 `.dmg` and `.zip`

Download published installers from the
[Releases](https://github.com/VickylastShao/deepseek-harness-desktop/releases)
page. Current builds are unsigned; Windows SmartScreen and macOS Gatekeeper may
therefore identify the publisher as unknown.

## Development

Node.js 24.18.1 is required. Preparing the seed downloads DeepSeek Harness and
builds its native dependencies for the current platform.

```bash
npm ci
npm test
npm run prepare:seed
npm run smoke:harness
npm run dist
```

Generated directories (`runtime-seed/`, `runtime-release/`, `build/`, and
`release/`) are excluded from Git.

## License

DeepSeek Harness Desktop is released under the [MIT License](LICENSE).
DeepSeek Harness and other bundled dependencies retain their own licenses; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
