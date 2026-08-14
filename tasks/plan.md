# Implementation Plan: Desktop Operations and Support Experience

## Overview

This iteration adds four connected product slices without changing the embedded
DeepSeek Harness UI: background task-completion notifications, a redacted
diagnostic bundle, a more informative desktop control center, and clearer
download/release documentation. The desktop shell remains Electron-based and
keeps startup free of update or diagnostic network work.

## Architecture Decisions

- Consume the official loopback-only `/api/events.host` WebSocket and react only
  to validated `host/session-status` transitions. Do not inject DOM observers or
  fork the Harness Web UI.
- Notify only after this desktop process observed `running: true` followed by
  `running: false`; reconnect snapshots must not create false completions.
- Reuse the existing `notifications` preference. Task notifications are shown
  only while the main window is hidden or minimized and open the existing
  window when clicked.
- Generate a gzip-compressed tar diagnostic bundle with the existing `tar`
  dependency. Include bounded, redacted logs and structured state; never copy
  the Harness credential store or session contents.
- Keep the control-center renderer sandboxed behind narrow preload methods.
- Generate tagged release notes from deterministic artifact names so every
  platform has a direct link, checksum guidance, and explicit signing status.

## Dependency Graph

```text
Harness host event protocol
  -> TaskCompletionMonitor
     -> native notification integration
     -> control-center monitor state

Runtime/update/recovery state
  -> desktop snapshot contract
     -> diagnostic report
     -> control-center rendering

Release artifact naming
  -> release-note generator
     -> GitHub Actions publish step
     -> README download guidance
```

## Task List

### Phase 1: Foundation and task completion

- [x] Task 1: Implement a reconnecting Harness task monitor.
  - Acceptance: connects only to the managed loopback origin; tracks running
    sessions; emits one completion for each observed true-to-false transition;
    malformed frames and disconnects fail soft.
  - Verification: `node --test test/task-completion-monitor.test.cjs`.
  - Files: `src/task-completion-monitor.cjs`,
    `test/task-completion-monitor.test.cjs`.
- [x] Task 2: Wire native task-completion notifications into the application.
  - Acceptance: starts after Harness readiness, stops on restart/quit, respects
    notification preferences, stays silent while the main window is visible,
    and restores the existing window when clicked.
  - Verification: focused monitor tests plus `npm test`.
  - Files: `src/main.cjs`, task monitor tests.

### Checkpoint: Task notifications

- [x] Focused tests pass.
- [x] Existing unit suite remains green.
- [x] No Web UI injection or additional network endpoint is introduced.

### Phase 2: Diagnostic bundle

- [x] Task 3: Build bounded redaction and archive generation.
  - Acceptance: replaces known private paths and credential-like values,
    truncates logs, writes report/log/readme files, and cleans temporary data.
  - Verification: `node --test test/diagnostic-bundle.test.cjs`.
  - Files: `src/diagnostic-bundle.cjs`, `test/diagnostic-bundle.test.cjs`.
- [x] Task 4: Add one-click export through the control center.
  - Acceptance: native save dialog, `.tar.gz` output, progress/result state,
    cancellation without error, no session or credential files included.
  - Verification: snapshot/IPC unit tests and control-center smoke coverage.
  - Files: `src/main.cjs`, `src/desktop-center-preload.cjs`, renderer files,
    `test/desktop-center.test.cjs`.

### Checkpoint: Support artifact

- [x] A generated archive contains only the documented three files.
- [x] Test fixtures prove secrets and home paths are absent.
- [x] Full unit suite passes.

### Phase 3: Control center operations view

- [x] Task 5: Extend the snapshot with operational state.
  - Acceptance: reports platform/runtime identity, endpoint, process state,
    task-monitor connection, bounded recovery state, and diagnostic status.
  - Verification: desktop-center and recovery tests.
  - Files: `src/desktop-center.cjs`, `src/runtime-recovery.cjs`,
    `src/harness-process.cjs`, associated tests.
- [x] Task 6: Render the operational state accessibly in Chinese and English.
  - Acceptance: responsive layout, live status updates, meaningful empty/error
    states, keyboard-accessible actions, no sensitive raw path in diagnostics.
  - Verification: tray/control-center Electron smoke and screenshot capture.
  - Files: `src/renderer/desktop-center.*`, capture/smoke scripts.

### Checkpoint: Operations UI

- [x] Snapshot contract and renderer agree.
- [x] Tray smoke and deterministic screenshot capture load the enhanced control center.
- [x] README screenshot can be regenerated from deterministic fixture state.

### Phase 4: Download and release experience

- [x] Task 7: Generate release notes with direct artifact links.
  - Acceptance: Windows, Ubuntu, Intel macOS, and Apple Silicon macOS links;
    checksum/signing/install guidance; optional generated change log.
  - Verification: release-note generator unit tests.
  - Files: `scripts/generate-release-notes.cjs`, test, workflow.
- [x] Task 8: Improve bilingual README install and troubleshooting sections.
  - Acceptance: current-version direct downloads, package types/architectures,
    verification steps, diagnostic export instructions, notification behavior,
    and explicit unsigned-build wording.
  - Verification: link/version assertions in tests and manual Markdown review.
  - Files: `README.md`, `README.zh-CN.md`.

### Checkpoint: Complete

- [x] `npm test` passes.
- [x] `npm run smoke:tray` passes in a graphical session.
- [x] `npm run dist -- --linux --x64 --publish never` succeeds where the local
  build environment supports it.
- [x] Git diff contains no generated runtime or installer artifacts.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Upstream host-event schema changes | Medium | Validate only the stable envelope and status frame; reconnect with bounded backoff; expose monitor failure without affecting Harness. |
| Duplicate completion notifications | Medium | Require an observed `true -> false` edge and clear session state after emission. |
| Sensitive data in support bundles | High | Allowlist report fields, redact known paths and secret patterns, bound log bytes, test negative assertions. |
| Diagnostic export blocks the UI | Low | Perform file reads/compression asynchronously and broadcast progress. |
| Release filenames drift | Medium | Generate links from the package version and validate expected names in unit tests. |
| Expanded UI becomes noisy | Low | Group operational facts into compact cards and keep advanced paths/actions below the primary status. |

## Open Questions Resolved for This Iteration

- Session titles are not guaranteed in the host status frame, so the
  notification uses a localized generic title plus a shortened session id.
- A diagnostic bundle is `.tar.gz`, not `.zip`, to avoid adding an archive
  dependency and increasing installer size.
- Existing `notifications` preference controls both tray-residency and task
  completion notifications.
