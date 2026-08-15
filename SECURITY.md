# Security policy

## Supported code

Security reports are evaluated against the current `main` branch and the most
recent published release. Older prereleases may be superseded rather than
patched individually.

DeepSeek Harness Desktop is an unofficial Electron host. Reports concerning
models, plugins, sessions, tools, or the upstream Web UI should be sent to the
[DeepSeek Harness repository](https://github.com/deepseek-ai/deepseek-harness).

## Report a vulnerability privately

Do not open a public issue for a suspected vulnerability. Use the repository's
[private vulnerability reporting form](https://github.com/VickylastShao/deepseek-harness-desktop/security/advisories/new).

Include only the information required to reproduce and assess the report:

- affected version, operating system, and architecture;
- prerequisites and exact reproduction steps;
- expected and observed security boundaries;
- a minimal proof of concept, if needed;
- whether the issue affects the Electron host, local Harness process, update
  path, diagnostics, or installer.

Do not include live credentials, model-provider keys, private prompts, session
data, or workspace files. If a proof requires sensitive material, describe how
to construct a synthetic equivalent instead.

The maintainer will use the private advisory to validate scope, coordinate a
fix, and prepare publication. Keep the report private until the advisory is
published or the maintainer confirms that disclosure is appropriate.

## Release trust

Release `v0.2.4` and earlier installers are unsigned. Verify published SHA-256
files and review the current [code-signing status](docs/CODE_SIGNING.md) before
installing. A signature is described as active only after the release workflow
has verified the final published bytes.
