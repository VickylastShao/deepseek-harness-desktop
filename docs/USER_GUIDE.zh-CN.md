# DeepSeek Harness Desktop 用户指南

[English](USER_GUIDE.md) · [项目说明](../README.zh-CN.md)

## 安装与首次启动

请从 [v0.2.2 Release](https://github.com/VickylastShao/deepseek-harness-desktop/releases/tag/v0.2.2)
下载对应平台的安装包。当前版本仍是未签名的预发布构建：

- Windows 可能显示 Microsoft Defender SmartScreen，请先核对发布者提示与 SHA-256。
- macOS 可能需要进入 **系统设置 → 隐私与安全性 → 仍要打开**。
- Linux AppImage 可能需要先执行 `chmod +x DeepSeek-Harness-Desktop-*.AppImage`。

安装过程会展开 Electron、Node.js 和经过校验的 Harness 种子运行时，因此可能比小型
桌面程序耗时更长。这些工作放在安装阶段完成，首次打开时就不需要再下载或编译大型依赖。

应用打开后：

1. 阅读并接受上游开发者预览提示。
2. 打开 **Settings → Models**，配置模型供应商。
3. 选择 Harness 可以使用的工作区。
4. 创建会话。

如果启动前没有设置 `DSH_DESKTOP_WORKSPACE`，默认工作区为用户主目录。

## 窗口、托盘与通知

- 启用 **Keep running when the window closes** 后，关闭主窗口只会隐藏应用。
- 再次启动程序会恢复已存在的单实例窗口。
- 托盘菜单可以重新打开或重启 Harness、检查更新、打开日志和明确退出。
- Windows 与 macOS 在系统支持时提供 **Start at Login**。
- 任务完成通知只会在主窗口隐藏或最小化时出现。
- 点击任务通知会恢复现有窗口。
- 执行 **Quit** 会停止受控 Harness 进程树，并取消后台下载。

Harness 异常退出后会在 1、5、15 秒后重试。五分钟内第四次失败将打开故障页面，
不会无限循环重启。

## 后台更新

应用启动过程不会等待网络更新请求。

| 通道 | 首次检查 | 后续检查 | 启用时机 |
| --- | --- | --- | --- |
| Harness 运行时 | Harness 就绪 30 秒后 | 每 6 小时 | 暂存后在下次正常启动时启用 |
| 桌面外壳 | 已签名正式构建中，Harness 就绪 60 秒后 | 每 6 小时 | 正常退出后安装，下次启动使用 |

暂存 Harness 运行时前，更新器会校验 HTTPS、声明大小、SHA-256、npm integrity、
Node.js 版本、Harness CLI 入口和平台原生 `node-pty` 模块。下载或完整性检查失败时，
当前版本保持不变，安装包内的种子运行时继续作为回退版本。

## 控制中心与诊断

桌面控制中心分别显示：

- 桌面外壳与 Harness 版本；
- 两条更新通道的状态；
- 进程健康度与恢复状态；
- 任务事件连接状态；
- 托盘、通知和开机启动偏好；
- 日志、本地数据和诊断导出入口。

**Export diagnostic bundle** 会生成受体积限制、经过模式脱敏的 `.tar.gz`，只包含
结构化桌面报告、桌面日志尾部和内容说明，不复制 Harness 会话、凭据或工作区文件。
公开诊断包前仍应先自行检查。

## 本地数据与安全边界

- Harness 状态、受管运行时、暂存更新和桌面日志保存在 Electron 当前用户应用数据目录。
- 卸载默认不会删除用户数据。
- 渲染进程关闭 Node.js 集成，并启用 Chromium 上下文隔离。
- 页面导航仅允许打包加载页和受控回环地址。
- 外部 HTTP/HTTPS 链接交给系统浏览器打开。

完整边界参见[隐私政策](../PRIVACY.md)与[代码签名政策](../CODE_SIGNING_POLICY.md)。

## 问题排查

| 现象 | 处理方法 |
| --- | --- |
| 安装耗时较长 | 等待安装程序完成内置运行时展开。该工作刻意放在安装阶段，避免首次打开变慢。 |
| 看不到托盘图标 | 检查任务栏、桌面面板或菜单栏的折叠区域；再次启动程序会恢复现有窗口。 |
| 没有任务完成通知 | 允许系统通知、保持 **Desktop Notifications** 开启，并隐藏或最小化主窗口。 |
| Harness 无法启动 | 打开 **Desktop Control Center**，导出并检查诊断包，然后连同复现步骤提交 Issue。 |
| 更新失败 | 继续使用当前已校验版本，应用会在后续后台周期重试。 |

桌面封装问题请提交到 [Issue Tracker](https://github.com/VickylastShao/deepseek-harness-desktop/issues)。
模型、插件、工具、会话或 Harness Web UI 问题请先查看
[上游文档](https://github.com/deepseek-ai/deepseek-harness/tree/master/docs)。
