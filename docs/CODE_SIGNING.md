# Release signing setup

The repository is signing-ready, but signing credentials are intentionally not
stored in source control. Release `v0.2.3` and earlier artifacts are unsigned.
A future version tag will fail during the signing preflight until both macOS and
Windows signing are configured.

Manual and scheduled development builds remain unsigned. This preserves local
development and the nightly runtime-channel build without weakening tagged
release enforcement.

## macOS Developer ID and notarization

Direct macOS distribution requires an active Apple Developer Program team, a
`Developer ID Application` certificate, and notarization credentials. Use a
team App Store Connect API key for CI rather than an Apple ID password.

Configure these GitHub Actions secrets:

| Secret | Value |
| --- | --- |
| `MAC_CSC_LINK` | Base64-encoded Developer ID Application `.p12` file |
| `MAC_CSC_KEY_PASSWORD` | Password used when exporting the `.p12` file |
| `APPLE_API_KEY` | Base64-encoded team App Store Connect `.p8` key |
| `APPLE_API_KEY_ID` | App Store Connect key ID |
| `APPLE_API_ISSUER` | App Store Connect issuer UUID |
| `APPLE_TEAM_ID` | Apple Developer team ID |

The release workflow enables Hardened Runtime, asks electron-builder to sign
and notarize both macOS architectures, and then requires all of these checks:

```bash
codesign --verify --deep --strict --verbose=2 "DeepSeek Harness Desktop.app"
spctl --assess --type execute --verbose=4 "DeepSeek Harness Desktop.app"
xcrun stapler validate "DeepSeek Harness Desktop.app"
```

## Windows option A: SignPath Foundation

This is the preferred path for the open-source project if its application is
accepted. The SignPath project must trust this GitHub repository and define an
artifact configuration whose root is the ZIP created by GitHub Actions and
whose signed output contains exactly one repackaged NSIS `.exe` installer.

Set this GitHub Actions repository variable:

```text
WINDOWS_SIGNING_PROVIDER=signpath
```

Configure these repository variables:

| Variable | Purpose |
| --- | --- |
| `SIGNPATH_ORGANIZATION_ID` | SignPath organization identifier |
| `SIGNPATH_PROJECT_SLUG` | SignPath project slug |
| `SIGNPATH_SIGNING_POLICY_SLUG` | Release signing policy slug |
| `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG` | NSIS artifact configuration slug |

Configure the `SIGNPATH_API_TOKEN` GitHub Actions secret. The workflow uploads
the unsigned installer as an immutable GitHub artifact, waits for SignPath, and
replaces it only with the signed result.

The application for free open-source signing must reference the repository's
[code signing policy](../CODE_SIGNING_POLICY.md) and
[privacy policy](../PRIVACY.md).

## Windows option B: certificate-backed signing

Use this path for an Authenticode certificate or compatible managed credential
that electron-builder can access through its standard certificate interface.

Set this repository variable:

```text
WINDOWS_SIGNING_PROVIDER=certificate
```

Configure these GitHub Actions secrets:

| Secret | Value |
| --- | --- |
| `WIN_CSC_LINK` | Certificate URL, path, or supported encoded certificate value |
| `WIN_CSC_KEY_PASSWORD` | Certificate password |

The Windows build enables electron-builder's `forceCodeSigning` gate. Regardless
of provider, the workflow requires PowerShell `Get-AuthenticodeSignature` to
return `Valid` for both the NSIS installer and the installed application before
generating SHA-256 files or uploading release artifacts.

## Preflight behavior

The release workflow runs:

```bash
node scripts/validate-release-signing.cjs
```

For a version tag, this command reports every missing variable or secret by
name and exits unsuccessfully. It never prints secret values. For scheduled or
manual development builds, it exits successfully without requiring credentials.

After configuring credentials, run the workflow manually with
`signing_validation` enabled. This executes signing and all platform verification
steps, then uploads the results as workflow artifacts without creating a GitHub
Release or changing the stable runtime channel. Leave the input disabled for an
ordinary unsigned development build. GitHub does not expose release secrets to
untrusted pull-request workflows.
