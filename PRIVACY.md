# Privacy policy

DeepSeek Harness Desktop is a local desktop wrapper around the upstream
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) project.
The wrapper does not include analytics, advertising, or telemetry collection,
and it does not upload desktop logs.

## Local data

The application stores Harness state, managed runtimes, pending updates, and
desktop logs in Electron's per-user application-data directory. Harness reads
or changes workspace files only under the permissions and workspace selected by
the user. Uninstalling the application does not delete user data by default.

## Network access

The desktop wrapper can make the following network requests:

- It checks this repository's HTTPS runtime channel and may download a verified
  DeepSeek Harness runtime update from GitHub Releases.
- Formal release builds check this repository's GitHub Releases for desktop
  application updates and may download the matching platform package.
- The upstream Harness process may communicate with model providers and services
  used by its plugins or configuration. Prompts, workspace context, and tool
  results sent through those services are governed by their own policies.
- External HTTP or HTTPS links selected in the Harness interface open in the
  system browser.

The wrapper serves Harness on a random IPv4 loopback port and permits its
Electron window to navigate only to that exact local origin. This policy covers
the desktop wrapper; upstream Harness, model providers, websites, and operating
system services have their own data practices.

## Project website

The project website stores the selected language and whether the optional
GitHub Star download prompt has already been handled in the browser's local
storage. These values stay in the browser and are not used for analytics. The
prompt always offers a direct download and does not request GitHub sign-in or
account permissions.

Questions or suspected privacy defects can be reported through the project's
[GitHub issue tracker](https://github.com/VickylastShao/deepseek-harness-desktop/issues).
