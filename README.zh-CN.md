<h1 align="center">DeepSeek Harness Desktop</h1>

<p align="center">
  <strong>将官方 DeepSeek Harness 体验封装为开箱即用的桌面应用。</strong><br>
  不需要常驻命令行窗口，也不要求用户预装 Node.js、npm 或本地编译工具链。
</p>

<p align="center">
  <a href="https://github.com/VickylastShao/deepseek-harness-desktop/releases/latest"><img alt="最新版本" src="https://img.shields.io/github/v/release/VickylastShao/deepseek-harness-desktop?style=flat-square"></a>
  <a href="https://github.com/VickylastShao/deepseek-harness-desktop/actions/workflows/build-installers.yml"><img alt="原生构建" src="https://github.com/VickylastShao/deepseek-harness-desktop/actions/workflows/build-installers.yml/badge.svg"></a>
  <img alt="Windows x64" src="https://img.shields.io/badge/Windows-x64-0078D4?style=flat-square&logo=windows11&logoColor=white">
  <img alt="macOS Intel 与 Apple Silicon" src="https://img.shields.io/badge/macOS-Intel%20%7C%20Apple%20Silicon-000000?style=flat-square&logo=apple&logoColor=white">
  <img alt="Linux x64" src="https://img.shields.io/badge/Linux-x64-FCC624?style=flat-square&logo=linux&logoColor=black">
  <a href="LICENSE"><img alt="MIT 许可证" src="https://img.shields.io/badge/License-MIT-2EA44F?style=flat-square"></a>
</p>

<p align="center">
  <a href="https://github.com/VickylastShao/deepseek-harness-desktop/releases/tag/v0.2.2"><strong>下载 v0.2.2 预发布版</strong></a>
  · <a href="https://vickylastshao.github.io/deepseek-harness-desktop/">官方网站</a>
  · <a href="#开始使用">开始使用</a>
  · <a href="#问题排查与支持">问题支持</a>
  · <a href="README.md">English</a>
</p>

<p align="center">
  <img src="docs/images/deepseek-harness-main.png" alt="DeepSeek Harness Desktop 中运行的 Harness 主会话页面" width="880">
</p>

> [!IMPORTANT]
> 本项目是社区维护的非官方封装，不是 DeepSeek 官方产品。上游 DeepSeek
> Harness 当前仍处于开发者预览阶段，后续可能出现破坏兼容性的变更。

## 下载

当前预发布版本为 **v0.2.2**。常规安装请选择对应平台的推荐安装包；有需要时也可以使用备选格式。

| 平台 | 推荐安装包 | 备选格式 | SHA-256 |
| --- | --- | --- | --- |
| Windows x64 | [安装程序 EXE](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.2/DeepSeek-Harness-Desktop-0.2.2-win-x64.exe) | — | [校验值](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.2/SHA256SUMS-win32-x64.txt) |
| Ubuntu/Debian x64 | [DEB](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.2/DeepSeek-Harness-Desktop-0.2.2-linux-amd64.deb) | [AppImage](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.2/DeepSeek-Harness-Desktop-0.2.2-linux-x86_64.AppImage) | [校验值](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.2/SHA256SUMS-linux-x64.txt) |
| Apple Silicon macOS | [DMG](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.2/DeepSeek-Harness-Desktop-0.2.2-mac-arm64.dmg) | [ZIP](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.2/DeepSeek-Harness-Desktop-0.2.2-mac-arm64.zip) | [校验值](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.2/SHA256SUMS-darwin-arm64.txt) |
| Intel macOS | [DMG](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.2/DeepSeek-Harness-Desktop-0.2.2-mac-x64.dmg) | [ZIP](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.2/DeepSeek-Harness-Desktop-0.2.2-mac-x64.zip) | [校验值](https://github.com/VickylastShao/deepseek-harness-desktop/releases/download/v0.2.2/SHA256SUMS-darwin-x64.txt) |

`v0.2.2` 及更早版本尚未签名，Windows SmartScreen 和 macOS Gatekeeper
可能显示“未知发布者”。后续正式标签版本的强制签名流程见[发布签名指南](docs/CODE_SIGNING.md)。

<details>
<summary><strong>校验下载文件</strong></summary>

从同一行下载校验文件，再对本地安装包计算 SHA-256：

```powershell
Get-FileHash .\DeepSeek-Harness-Desktop-0.2.2-win-x64.exe -Algorithm SHA256
```

```bash
sha256sum DeepSeek-Harness-Desktop-0.2.2-linux-amd64.deb
```

</details>

## 开始使用

1. 安装并打开 **DeepSeek Harness Desktop**。
2. 阅读并确认上游开发者预览提示。
3. 进入 **Settings → Models** 配置模型服务。
4. 选择允许 Harness 操作的工作区。
5. 创建会话并描述需要完成的任务。

默认工作区是用户主目录；可以在启动前通过 `DSH_DESKTOP_WORKSPACE`
指定其他默认目录。

## 桌面版增加了什么？

DeepSeek Harness 本身可以通过 `npx @deepseek-ai/dsh web` 从终端运行。本项目不
fork、不注入或重写上游 Web UI，只把启动、进程管理、更新和系统集成封装为常规桌面应用。

| 桌面能力 | 用户获得的变化 |
| --- | --- |
| 独立运行时 | 安装包自带 Node.js 和平台原生 Harness；首次打开不等待前置下载或现场编译。 |
| 一键生命周期 | 后台启动 Harness，不显示命令行窗口，并只维护一个受控进程。 |
| 系统托盘 | 主窗口隐藏后仍可恢复、重启、检查更新、查看日志或彻底退出。 |
| 后台任务通知 | 窗口隐藏或最小化时通知任务完成；点击通知恢复应用。 |
| 两条暂存更新通道 | 分别更新 Harness 与桌面外壳，不替换正在运行的会话。 |
| 有界异常恢复 | Harness 异常退出后按退避策略重试，连续失败时停止而不是无限循环。 |
| 控制中心与诊断 | 展示实时运行状态，并导出有大小上限且脱敏的诊断包。 |
| 本机访问边界 | 只加载应用管理的随机 `127.0.0.1` 端口。 |

## DeepSeek Harness 是什么？

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（命令名为
`dsh`）是 DeepSeek 开发的开源智能体框架。其 Web UI 统一连接模型服务、工作区、
会话、工具、计划和需要审批的操作，并由 [Cordis](https://github.com/cordiverse/cordis)
驱动插件化架构。

本仓库只负责桌面宿主、进程生命周期、更新、诊断和安装包；Harness 本身仍以上游为准。
权威功能与插件说明见上游的
[Web UI 指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/index.zh.md)
和[架构文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.zh.md)。

## 产品截图

<table>
  <tr>
    <td align="center"><strong>桌面启动器</strong></td>
    <td align="center"><strong>桌面控制中心</strong></td>
  </tr>
  <tr>
    <td><img src="docs/images/desktop-startup.png" alt="DeepSeek Harness Desktop 启动界面"></td>
    <td><img src="docs/images/desktop-control-center-hero.png" alt="DeepSeek Harness Desktop 控制中心"></td>
  </tr>
</table>

控制中心会分别展示桌面外壳与 Harness 版本、更新状态、进程健康、
任务事件连接、异常恢复、偏好设置、诊断和本地数据入口。全部截图均由
`npm run capture:screenshots` 从真实 Electron 页面与内置 Harness 运行时生成。

## 日常使用行为

- 启用“关闭窗口后继续运行”后，关闭主窗口只会隐藏应用；再次启动会恢复已有窗口。
- 托盘“偏好设置”会保存关闭到托盘和通知选项；Windows 与 macOS 还支持“开机启动”。
- 任务完成通知只在主窗口隐藏或最小化时出现。
- Harness 异常退出后分别等待 1 秒、5 秒和 15 秒重试；5 分钟内第 4 次失败会进入错误页。

## 不增加启动耗时的更新

应用启动路径不等待网络请求。

| 更新通道 | 首次检查 | 后台行为 | 启用时机 |
| --- | --- | --- | --- |
| Harness 运行时 | Harness 就绪 30 秒后，之后每 6 小时 | 当前会话继续运行时下载并校验平台原生运行时。 | 下次正常启动应用 |
| 桌面外壳 | 已签名正式版本中，Harness 就绪 60 秒后，之后每 6 小时 | 后台下载新版安装程序，不中断 Harness。 | 正常退出后安装，下次启动使用 |

下载或完整性校验失败不会改变活动版本；安装包内的 Harness 运行时始终保留为回退。

<details>
<summary><strong>Harness 运行时校验项目</strong></summary>

暂存新运行时之前，更新器会检查 HTTPS、声明文件大小、SHA-256、npm integrity、
所需 Node.js 版本、Harness CLI 入口和平台原生 `node-pty` 模块。

</details>

## 安全与本地数据

- Renderer 禁用 Node.js integration，并启用 Chromium context isolation。
- 窗口只允许访问安装包内启动页和应用管理的精确回环地址。
- 外部 HTTP/HTTPS 链接交给系统浏览器打开。
- Harness 数据、托管运行时、暂存更新和桌面日志保存在 Electron 用户应用数据目录。
- 从托盘选择“彻底退出”会终止 Harness 进程树并取消后台下载；卸载默认不删除用户数据。

“导出诊断包”会创建一个有大小上限并按模式脱敏的 `.tar.gz`，只包含结构化
桌面状态报告、桌面日志末尾和内容说明；不会复制 Harness 会话、凭据库或工作区文件。
公开上传前仍应先检查压缩包内容。

完整边界见[隐私政策](PRIVACY.md)和[代码签名政策](CODE_SIGNING_POLICY.md)。

## 问题排查与支持

| 现象 | 处理方法 |
| --- | --- |
| 安装阶段耗时较长 | 等待安装程序解压 Electron、Node.js 和已校验的 Harness seed。这些工作放在安装阶段，是为了保持首次打开速度。 |
| 看不到托盘图标 | 检查任务栏、桌面面板或菜单栏的隐藏区域；再次启动应用会恢复已有窗口。 |
| 没有任务完成通知 | 允许系统通知、保持“桌面通知”开启，并隐藏或最小化主窗口。 |
| Harness 无法启动 | 打开“桌面控制中心”，导出并检查诊断包，再附上复现步骤提交 Issue。 |

桌面封装问题请提交到 [GitHub Issues](https://github.com/VickylastShao/deepseek-harness-desktop/issues)。
模型、插件或 Harness Web UI 行为请先查阅
[上游 Harness 文档](https://github.com/deepseek-ai/deepseek-harness/tree/master/docs)。

## 本地开发

要求 Node.js `24.18.1`。准备 seed 时会从官方 npm registry 下载 DeepSeek Harness，
并为当前平台构建原生依赖。

```bash
npm ci
npm test
npm run smoke:tray
npm run prepare:seed
npm run smoke:harness
npm run dist
```

在图形桌面会话中重新生成 README 截图：

```bash
npm run capture:screenshots
```

`runtime-seed/`、`runtime-release/`、`build/` 和 `release/`
均为生成目录，不进入 Git。

<details>
<summary><strong>运行时配置</strong></summary>

| 环境变量 | 用途 | 默认值 |
| --- | --- | --- |
| `DSH_RUNTIME_CHANNEL_URL` | 覆盖 HTTPS 运行时更新清单。 | 安装包内置通道 |
| `DSH_UPDATE_DELAY_MS` | 首次 Harness 更新检查延迟。 | `30000` |
| `DSH_UPDATE_INTERVAL_MS` | Harness 后续检查间隔。 | `21600000` |
| `DSH_DESKTOP_UPDATE_DELAY_MS` | 桌面外壳首次检查延迟。 | `60000` |
| `DSH_DESKTOP_UPDATE_INTERVAL_MS` | 桌面外壳后续检查间隔。 | `21600000` |
| `DSH_DESKTOP_WORKSPACE` | Harness 初始工作目录。 | 用户主目录 |
| `DSH_RUNTIME_SEED` | 仅供开发测试，覆盖内置 seed。 | 安装包 seed |

</details>

## 发布机制

GitHub Actions 在各目标系统的原生 runner 上构建并执行启动检查。正式标签版本包含
安装包和 SHA-256 文件；独立的
[`runtime-channel`](https://github.com/VickylastShao/deepseek-harness-desktop/releases/tag/runtime-channel)
Release 保存后台 Harness 更新使用的已校验清单和运行时归档。

后续正式标签版本必须在发布前通过 macOS Developer ID 签名与公证和 Windows
Authenticode 验签；手动开发构建和定时运行时构建仍可保持未签名。配置方法见
[docs/CODE_SIGNING.md](docs/CODE_SIGNING.md)。

## 许可证

本桌面封装采用 [MIT License](LICENSE)。DeepSeek Harness 和其他依赖保留各自许可证，
详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
