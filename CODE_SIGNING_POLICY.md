# Code signing policy

DeepSeek Harness Desktop publishes release artifacts only from the public
[`VickylastShao/deepseek-harness-desktop`](https://github.com/VickylastShao/deepseek-harness-desktop)
repository and its GitHub Actions release workflow.

The prepared Windows signing path is subject to application approval:
**Free code signing provided by SignPath.io, certificate by SignPath Foundation.**
This repository will not describe SignPath signing as active until that approval
has been received and a signed artifact has passed the release verification.

## Project roles

- Committer and reviewer: [VickylastShao](https://github.com/VickylastShao)
- Release and signing approver: [VickylastShao](https://github.com/VickylastShao)

Changes proposed by anyone without direct commit access require review by the
committer. Signing requests may be approved only by the release and signing
approver. Multi-factor authentication is required for accounts with commit,
review, release, or signing access.

## Release controls

- Public releases originate from version tags in this repository.
- The release workflow runs the test suite and builds each platform on a native
  GitHub-hosted runner.
- The packaged DeepSeek Harness runtime is launched and checked through its real
  local HTTP server before an installer can be published.
- Windows and macOS tag builds must pass the signing-configuration preflight.
- Windows Authenticode signatures and macOS Developer ID signatures plus
  notarization tickets are verified before checksums are generated.
- SHA-256 files are published alongside every installer.
- Signing credentials and private keys must be held by the signing provider or
  encrypted GitHub Actions secrets. They must never be committed to the
  repository or written to workflow logs.

See the [privacy policy](PRIVACY.md) and the detailed
[signing setup guide](docs/CODE_SIGNING.md).
