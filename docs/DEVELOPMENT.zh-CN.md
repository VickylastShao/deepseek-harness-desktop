# 开发与发布指南

[English](DEVELOPMENT.md) · [项目说明](../README.zh-CN.md)

## 环境要求

- Node.js `24.18.1`
- 与锁文件兼容的 npm
- 执行 Electron 截图和托盘烟测时需要图形桌面会话
- 只有重新生成 README 媒体时才需要 Python 3、Pillow 和 CairoSVG

准备种子运行时会从官方 npm Registry 下载 DeepSeek Harness，并为当前平台构建原生依赖。

## 常用命令

```bash
npm ci
npm test
npm run smoke:tray
npm run prepare:seed
npm run smoke:harness
npm run package:runtime
npm run dist
```

`prepare:seed` 只在开发机或 CI 构建机联网获取运行时；`package:runtime` 将验证过的
运行时生成一个离线压缩包和元数据，安装器不会在用户终端下载依赖。应用首次启动且
没有可用的本地运行时时，才会把该压缩包校验、解压并原子启用到用户数据目录。

生成的运行时与安装包目录（`runtime-seed/`、`runtime-release/`、`build/`、
`release/`）不会提交到 Git。

## 截图与 README 媒体

在图形桌面会话中捕获应用截图：

```bash
npm run capture:screenshots
```

该脚本会把真实启动页、Harness 会话页和控制中心截图写入 `docs/images/`。

基于这些截图重新生成 README 动图和社交预览图：

```bash
python3 -m pip install Pillow==12.2.0 CairoSVG==2.9.0
python3 scripts/generate-readme-media.py
```

验证已提交的输入/输出哈希清单仍然有效，并在不修改工作区的前提下确认生成器
仍可产生视觉内容匹配的媒体；比较过程允许渲染器造成的微小差异。CI 工作流会
安装 Noto Sans CJK，避免中文字幕回退为缺失字符。

```bash
python3 -m pip install -r docs/media-requirements.txt
python3 scripts/generate-readme-media.py --check
```

生成器强制执行以下交付约束：

- `desktop-workflow.gif`：960×600，不超过 5 MiB；
- `social-preview.png`：1280×640，小于 1 MiB；
- 只使用仓库中的真实截图与现有 SVG 图形。

生成后执行 `npm test`。README 测试会检查图片路径、尺寸、文件签名、体积预算、
Release 链接和中英文结构。

## 运行时配置

| 环境变量 | 用途 | 默认值 |
| --- | --- | --- |
| `DSH_RUNTIME_CHANNEL_URL` | 覆盖 HTTPS Harness 运行时通道清单。 | 内置 Release 通道 |
| `DSH_UPDATE_DELAY_MS` | 首次 Harness 更新检查延迟。 | `30000` |
| `DSH_UPDATE_INTERVAL_MS` | 后续 Harness 更新检查间隔。 | `21600000` |
| `DSH_DESKTOP_UPDATE_DELAY_MS` | 首次桌面外壳更新检查延迟。 | `60000` |
| `DSH_DESKTOP_UPDATE_INTERVAL_MS` | 后续桌面外壳更新检查间隔。 | `21600000` |
| `DSH_DESKTOP_WORKSPACE` | Harness 初始工作目录。 | 用户主目录 |
| `DSH_RUNTIME_SEED` | 开发和测试时用已展开目录覆盖内置运行时归档。 | 打包的离线归档 |

## 发布工程

GitHub Actions 使用各平台原生 Runner 构建并烟测安装包。带标签的 Release 发布
平台安装包和 SHA-256 文件。独立的
[`runtime-channel`](https://github.com/VickylastShao/deepseek-harness-desktop/releases/tag/runtime-channel)
Release 保存后台 Harness 更新使用的已校验清单和压缩包。

启用运行时前，应用会检查传输方式、声明大小、SHA-256、npm integrity、Node.js
兼容性、Harness 入口和平台原生终端依赖。准备后的更新元数据描述最终安装包字节，
而不是签名前的临时产物。

未来带标签的正式 Release 必须通过 macOS Developer ID 签名与公证，以及 Windows
Authenticode 校验。手动开发构建和计划运行时构建可以保持未签名。参见
[CODE_SIGNING.md](CODE_SIGNING.md)和仓库[代码签名政策](../CODE_SIGNING_POLICY.md)。

## 项目边界

本仓库负责 Electron 宿主、进程生命周期、原生集成、更新暂存、诊断和打包。
DeepSeek Harness 负责 Agent 运行时、插件、会话、模型、工具和 Web UI。
如果桌面宿主层能够解决问题，应避免修改或向上游 UI 注入代码。
