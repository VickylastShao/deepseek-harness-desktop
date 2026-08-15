# Contributing to DeepSeek Harness Desktop

Thank you for helping improve the unofficial desktop host for DeepSeek Harness.
This repository owns the Electron host, native desktop integration, update and
recovery controls, diagnostics, and installer pipeline. Agent behavior, models,
plugins, sessions, tools, and the Harness Web UI belong to the upstream
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) project.

Before opening an issue or pull request, check that the change belongs to this
desktop repository rather than upstream Harness.

## Report an issue or propose a change

- Use a bug report for reproducible desktop-wrapper, installer, update, tray,
  notification, or diagnostics defects.
- Use a feature request for a concrete desktop-host capability or workflow.
- Use [GitHub Discussions](https://github.com/VickylastShao/deepseek-harness-desktop/discussions)
  for setup questions, early ideas, and open-ended design discussion.
- Report suspected security vulnerabilities privately according to
  [SECURITY.md](SECURITY.md).

Search existing issues and discussions first. Include the application version,
operating system and architecture, exact reproduction steps, and the smallest
diagnostic evidence needed. Review diagnostic bundles before sharing them and
never attach credentials, prompts, session data, or private workspace files.

## Development setup

Node.js `24.18.1` is required. Start from the current default branch and keep
each change focused on one independently reviewable concern.

```bash
npm ci
npm test
```

Use the relevant smoke check when a change affects a packaged or runtime path:

```bash
npm run smoke:harness
npm run smoke:update
npm run smoke:tray
```

See the [development and release guide](docs/DEVELOPMENT.md) for packaging,
runtime-channel, media, and release details.

## Pull requests

1. Explain the user-visible behavior and the project boundary affected.
2. Add or update tests for behavior changes.
3. Run `npm test` and any relevant smoke check.
4. Keep generated media and its hash manifest synchronized when documentation
   media changes.
5. Do not commit signing credentials, provider keys, diagnostic archives,
   runtime downloads, or generated release directories.
6. Update the English and Simplified Chinese documents together when changing
   user-facing documentation.

Pull requests must pass the repository's required checks before merge. Release
signing and publication remain maintainer-controlled operations.

## Scope and compatibility

- Prefer upstream-compatible hosting over patches or script injection into the
  Harness Web UI.
- Keep renderer Node.js integration disabled and context isolation enabled.
- Keep navigation limited to packaged pages and the selected loopback origin.
- Treat update metadata, downloaded runtimes, and installers as untrusted until
  their declared integrity and platform requirements are verified.
- Preserve the explicit unsigned-prerelease notice until release verification
  proves that signing is active.

By contributing, you agree that your contribution is provided under this
repository's [MIT License](LICENSE).
