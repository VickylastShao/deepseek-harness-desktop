# DeepSeek Harness Desktop

这是 DeepSeek Harness 的 Electron 桌面封装。应用内置独立 Node.js 和经过验证的 Harness 运行时，用户启动应用时不需要打开终端，也不需要预装 Node.js、npm 或编译工具链。

## 更新行为

启动路径完全不访问网络：

1. 如果上次运行已准备好更新，则把 `pending.json` 原子提升为 `active.json`。
2. 启动 active 版本；active 不可用时回退到安装包内的只读 seed 版本。
3. Harness 在随机本机端口启动，Electron 只加载该 `127.0.0.1` Origin。

页面加载完成 30 秒后，后台更新器开始第一次检查；之后每 6 小时检查一次。发现更高版本时，只下载当前操作系统和 CPU 架构对应的预构建运行时包，校验 HTTPS、声明大小、SHA-256、npm integrity、Node 版本、Harness CLI 和 `node-pty` 原生模块，然后写入 pending。当前进程不会被替换、不会弹窗、不会自动重启；下一次正常启动才启用新版本。网络失败或更新校验失败只写本地日志，不影响当前版本。

之所以不在用户机器执行 `npm install`，是因为 Harness 的原生依赖可能要求 C/C++ 编译环境。这些原生模块由 CI 在 Windows、Ubuntu、Intel macOS 和 Apple Silicon macOS 上分别构建。

可调试环境变量：

- `DSH_RUNTIME_CHANNEL_URL`：覆盖运行时更新清单 URL；必须使用 HTTPS。
- `DSH_UPDATE_DELAY_MS`：首次后台检查延迟，默认 30000。
- `DSH_UPDATE_INTERVAL_MS`：后续检查间隔，默认 21600000。
- `DSH_DESKTOP_WORKSPACE`：Harness 默认工作目录。
- `DSH_RUNTIME_SEED`：仅用于开发测试，覆盖内置 seed 目录。

## 本地开发和 Ubuntu 构建

要求 Node.js 24.18.1。首次构建 seed 会从官方 npm registry 拉取 DeepSeek Harness 及其依赖，并在本机编译/验证原生模块。

```bash
npm ci
npm test
npm run prepare:seed
npm run smoke:harness
npm run dist -- --linux --x64
```

输出位于 `release/`，包括 AppImage 和 deb。`runtime-seed/`、`runtime-release/`、`build/`、`release/` 都是生成目录，不进入 Git。

## 三平台安装包

[`.github/workflows/build-installers.yml`](.github/workflows/build-installers.yml) 使用目标系统的原生 GitHub runner：

- Windows x64：NSIS `.exe`；
- Ubuntu x64：`.AppImage` 和 `.deb`；
- macOS Intel：x64 `.dmg` 和 `.zip`；
- macOS Apple Silicon：arm64 `.dmg` 和 `.zip`。

手动运行工作流会生成四组可下载构建产物，并刷新固定的 `runtime-channel` Release。每天的定时任务只重建并刷新平台运行时，不重复生成安装包。推送 `v*` 标签会同时创建安装包 Release。

自动更新通道要求 GitHub 仓库和 `runtime-channel` Release 可匿名下载；私有仓库需要改成支持客户端认证的 HTTPS 文件服务。CI 会把当前仓库的固定更新 URL 写入安装包，源码中的 `runtimeChannel` 默认留空，防止未配置仓库时误连占位地址。

## 签名边界

当前工作流明确生成未签名安装包。文件本身可构建和校验，但 Windows SmartScreen 和 macOS Gatekeeper 可能显示未知发布者。正式分发应在对应平台配置代码签名；macOS 的签名和公证必须在 macOS runner 完成。不要把未签名构建描述为已通过操作系统发布者验证。

## 本地数据

Harness 数据、活动运行时、pending 更新和日志均位于 Electron `userData` 目录。卸载程序默认不删除用户数据。退出应用时会终止 Harness 及其子进程树；如果后台下载仍在进行，会先取消并清理 staging 文件。
