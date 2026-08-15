<h1 align="center">DeepSeek Harness Desktop</h1>

<p align="center">
  <strong>无需命令行，直接使用 DeepSeek Harness。</strong><br>
  面向 Windows、macOS 和 Linux 的自包含式桌面应用。
</p>

<p align="center">
  <a href="https://github.com/VickylastShao/deepseek-harness-desktop/releases/tag/v0.2.3"><img alt="最新预发布版本" src="https://img.shields.io/github/v/release/VickylastShao/deepseek-harness-desktop?include_prereleases&style=flat-square"></a>
  <a href="https://github.com/VickylastShao/deepseek-harness-desktop/actions/workflows/build-installers.yml"><img alt="原生平台构建" src="https://github.com/VickylastShao/deepseek-harness-desktop/actions/workflows/build-installers.yml/badge.svg"></a>
  <img alt="Windows、macOS 和 Linux" src="https://img.shields.io/badge/Windows%20%7C%20macOS%20%7C%20Linux-07111F?style=flat-square">
  <a href="LICENSE"><img alt="MIT 许可证" src="https://img.shields.io/badge/License-MIT-2EA44F?style=flat-square"></a>
</p>

<p align="center">
  <a href="https://vickylastshao.github.io/deepseek-harness-desktop/"><strong>下载 v0.2.3</strong></a>
  · <a href="#开始使用">开始使用</a>
  · <a href="docs/USER_GUIDE.zh-CN.md">用户指南</a>
  · <a href="README.md">English</a>
</p>

<p align="center">
  <img src="docs/images/deepseek-harness-main.png" alt="DeepSeek Harness Desktop 中运行的 Harness 主会话页面" width="880">
</p>

> [!IMPORTANT]
> 本项目是非官方社区项目，不属于 DeepSeek 产品。上游 DeepSeek Harness
> 仍处于开发者预览阶段，后续版本可能包含不兼容改动。

## 为什么需要桌面版？

| 无需命令行 | 首次启动快 | 后台静默更新 |
| --- | --- | --- |
| 无需常驻命令行窗口，也不要求全局安装 Node.js。 | 安装包自带经过校验的平台运行时，首次打开无需等待编译或下载大型依赖。 | 启动后再检查更新，在不打断当前会话的情况下完成校验和暂存，重启后启用。 |

## 实际体验

<details>
<summary><strong>播放 7 秒产品演示</strong></summary>

<p align="center">
  <img src="docs/images/desktop-workflow.gif" alt="DeepSeek Harness Desktop 无需命令行即可启动，随后进入未经修改的上游 Harness 主页面，并可在控制中心查看运行状态和更新" width="880">
</p>

</details>

演示使用真实 Electron 应用截图：

1. 无需命令行即可启动。
2. 使用未经修改的上游 Harness Web UI。
3. 在控制中心检查运行状态、待启用更新和支持工具。

## 下载

当前预发布版本为 **v0.2.3**。优先选择各平台的常规安装程序；部分平台同时提供备用格式。

| 平台 | 推荐 | 备用格式 | SHA-256 |
| --- | --- | --- | --- |
| Windows x64 | [安装程序 EXE](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.3/DeepSeek-Harness-Desktop-0.2.3-win-x64.exe) | — | [校验文件](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.3/SHA256SUMS-win32-x64.txt) |
| Ubuntu/Debian x64 | [DEB](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.3/DeepSeek-Harness-Desktop-0.2.3-linux-amd64.deb) | [AppImage](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.3/DeepSeek-Harness-Desktop-0.2.3-linux-x86_64.AppImage) | [校验文件](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.3/SHA256SUMS-linux-x64.txt) |
| macOS Apple 芯片 | [DMG](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.3/DeepSeek-Harness-Desktop-0.2.3-mac-arm64.dmg) | [ZIP](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.3/DeepSeek-Harness-Desktop-0.2.3-mac-arm64.zip) | [校验文件](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.3/SHA256SUMS-darwin-arm64.txt) |
| macOS Intel | [DMG](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.3/DeepSeek-Harness-Desktop-0.2.3-mac-x64.dmg) | [ZIP](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.3/DeepSeek-Harness-Desktop-0.2.3-mac-x64.zip) | [校验文件](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.3/SHA256SUMS-darwin-x64.txt) |

`v0.2.3` 及更早版本的安装包尚未签名。Windows SmartScreen 或 macOS Gatekeeper
可能显示“未知发布者”提示。安装前请阅读[代码签名状态](docs/CODE_SIGNING.md)。

<details>
<summary><strong>校验下载的安装包</strong></summary>

```powershell
Get-FileHash .\DeepSeek-Harness-Desktop-0.2.3-win-x64.exe -Algorithm SHA256
```

```bash
sha256sum DeepSeek-Harness-Desktop-0.2.3-linux-amd64.deb
```

</details>

## 开始使用

1. 安装并打开 **DeepSeek Harness Desktop**。
2. 阅读并接受上游开发者预览提示。
3. 打开 **Settings → Models**，配置模型供应商。
4. 选择工作区、创建会话并描述任务。

默认工作区为用户主目录。启动前设置 `DSH_DESKTOP_WORKSPACE` 可指定其他默认目录。

## 桌面版增加了什么？

DeepSeek Harness 本身可以通过 `npx @deepseek-ai/dsh web` 在命令行中运行。
本项目封装该流程，但不会 fork 或向上游 Harness Web UI 注入代码。

| 桌面能力 | 用户体验 |
| --- | --- |
| 原生窗口外观 | Harness 内容延伸到窗口边缘，同时保留 Windows 贴靠布局和 macOS 交通灯按钮。 |
| 自包含运行时 | 安装包内置 Node.js 和平台原生 Harness 运行时。 |
| 受控生命周期 | 在随机回环端口启动单个隐藏进程，并在明确退出时停止进程树。 |
| 系统托盘与通知 | 窗口隐藏后保持会话运行，并在后台任务完成时发送通知。 |
| 两条独立更新通道 | 不延迟启动、不替换当前会话，分别暂存 Harness 与桌面外壳更新。 |
| 恢复与诊断 | 对异常退出进行有限重试，并导出受限、脱敏的诊断包。 |
| 本地导航边界 | 只允许加载打包页面和受控的 `127.0.0.1` 服务地址。 |

## 项目边界

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）提供
Agent 运行时、插件、会话、工具和 Web UI。本仓库负责 Electron 宿主、原生系统集成、
后台更新、诊断和安装包；Harness 功能仍以上游文档为准。

- 渲染进程关闭 Node.js 集成，并启用 Chromium 上下文隔离。
- 外部 HTTP/HTTPS 链接由系统浏览器打开。
- Harness 状态与桌面日志保存在当前用户的应用数据目录。
- 诊断包不复制会话、凭据或工作区文件。

完整边界参见[隐私政策](PRIVACY.md)、[用户指南](docs/USER_GUIDE.zh-CN.md)和
[代码签名政策](CODE_SIGNING_POLICY.md)。

## 文档

- [用户指南](docs/USER_GUIDE.zh-CN.md)：托盘、更新、本地数据、诊断和问题排查。
- [开发与发布指南](docs/DEVELOPMENT.zh-CN.md)：环境配置、媒体生成和发布流程。
- [上游 Harness 文档](https://github.com/deepseek-ai/deepseek-harness/tree/master/docs)：模型、插件、工具、会话和 Web UI。

桌面封装问题请提交到 [Issue Tracker](https://github.com/VickylastShao/deepseek-harness-desktop/issues)。

## 本地开发

需要 Node.js `24.18.1`。

```bash
npm ci
npm test
npm run smoke:harness
npm run dist
```

完整流程参见 [docs/DEVELOPMENT.zh-CN.md](docs/DEVELOPMENT.zh-CN.md)。

## 许可证

DeepSeek Harness Desktop 采用 [MIT License](LICENSE)。DeepSeek Harness
及打包依赖保留各自许可证，详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
