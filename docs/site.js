'use strict'

const copy = {
  en: {
    skip: 'Skip to content', navFeatures: 'Features', navDownloads: 'Downloads', navGithub: 'GitHub',
    eyebrow: 'Open source · v0.2.2 prerelease', heroTitle: 'DeepSeek Harness,<br>without the terminal.',
    heroLede: 'A self-contained desktop host for the official Harness Web UI. Install it, open it, and start working on Windows, macOS, or Linux.',
    chooseDownload: 'Choose a download', viewSource: 'View source', heroNote: 'No system-wide Node.js. No persistent command window. No first-launch download.',
    proofRuntimeTitle: 'Self-contained', proofRuntimeBody: 'Node.js + native Harness runtime', proofPlatformsTitle: 'Cross-platform', proofPlatformsBody: 'Windows, macOS, and Linux',
    proofUpdatesTitle: 'Quiet updates', proofUpdatesBody: 'Downloaded in the background', proofOpenTitle: 'Open source', proofOpenBody: 'MIT licensed desktop host',
    featuresEyebrow: 'Built for daily use', featuresTitle: 'The desktop layer Harness was missing.',
    featuresLede: 'The upstream Web UI stays intact. The desktop app handles everything around it: startup, process health, updates, recovery, notifications, and support data.',
    featureOneTitle: 'Open and work', featureOneBody: 'The installer includes the runtime. Harness starts in the background without exposing a console window.',
    featureTwoTitle: 'Stay out of the way', featureTwoBody: 'Close to the tray, receive task-completion notifications, and reopen the same managed session.',
    featureThreeTitle: 'Update without waiting', featureThreeBody: 'Harness and desktop updates are checked after launch, staged in the background, and activated on the next restart.',
    featureFourTitle: 'Diagnose in one step', featureFourBody: 'The control center exposes runtime health and exports a bounded, redacted diagnostic bundle for support.',
    downloadsEyebrow: 'Download v0.2.2', downloadsTitle: 'Pick your platform.', downloadsLede: 'Current installers are unsigned prerelease builds. Check the published SHA-256 file after downloading.',
    downloadWindows: 'Download for Windows', viewChecksum: 'View checksum', viewChecksums: 'View checksums', allReleaseFiles: 'Release notes and all package formats →',
    boundaryEyebrow: 'Clear project boundary', boundaryTitle: 'Upstream Harness inside. Community desktop host outside.',
    boundaryBody: 'DeepSeek Harness supplies the agent runtime, plugin system, and Web UI. This repository supplies the Electron host, process lifecycle, staged updates, diagnostics, tray integration, and native installers.',
    boundaryNotice: 'This is an unofficial community project and is not a DeepSeek product.', upstream: 'Upstream Harness', privacy: 'Privacy', support: 'Support',
    downloadPromptEyebrow: 'Support open source', downloadPromptTitle: 'Your download is ready.',
    downloadPromptDescription: 'If this project is useful to you, consider leaving a Star on GitHub. It helps more people discover the project.',
    downloadPromptStar: 'Star on GitHub &amp; download', downloadPromptDirect: 'Download without starring',
    downloadPromptNote: 'No GitHub sign-in or permission is requested by this website.', downloadPromptClose: 'Close download prompt',
  },
  zh: {
    skip: '跳到正文', navFeatures: '功能', navDownloads: '下载', navGithub: 'GitHub',
    eyebrow: '开源 · v0.2.2 预发布版', heroTitle: '使用 DeepSeek Harness，<br>不再守着命令行。',
    heroLede: '为官方 Harness Web UI 提供完整的桌面宿主。安装、打开，即可在 Windows、macOS 或 Linux 上开始工作。',
    chooseDownload: '选择安装包', viewSource: '查看源码', heroNote: '无需全局 Node.js，无需常驻命令行窗口，首次启动无需下载运行时。',
    proofRuntimeTitle: '自带运行时', proofRuntimeBody: 'Node.js + 平台原生 Harness', proofPlatformsTitle: '跨平台', proofPlatformsBody: 'Windows、macOS 与 Linux',
    proofUpdatesTitle: '无感更新', proofUpdatesBody: '运行期间后台下载', proofOpenTitle: '开源', proofOpenBody: 'MIT 许可的桌面宿主',
    featuresEyebrow: '面向日常使用', featuresTitle: '补齐 Harness 缺少的桌面层。',
    featuresLede: '上游 Web UI 保持原样。桌面应用负责外围工作：启动、进程健康、更新、异常恢复、通知与支持数据。',
    featureOneTitle: '打开即可工作', featureOneBody: '安装包已经包含运行时；Harness 在后台启动，不会弹出命令行窗口。',
    featureTwoTitle: '需要时出现', featureTwoBody: '关闭到托盘、接收任务完成通知，再次打开时恢复同一个受控会话。',
    featureThreeTitle: '更新不必等待', featureThreeBody: '应用启动后再检查 Harness 与桌面更新，后台暂存，并在下次重启后启用。',
    featureFourTitle: '一键完成诊断', featureFourBody: '控制中心展示运行状态，并可导出有大小上限、经过脱敏的诊断包。',
    downloadsEyebrow: '下载 v0.2.2', downloadsTitle: '选择你的平台。', downloadsLede: '当前安装包是尚未签名的预发布构建。下载后请核对发布页提供的 SHA-256。',
    downloadWindows: '下载 Windows 版', viewChecksum: '查看校验值', viewChecksums: '查看校验值', allReleaseFiles: '发行说明与全部安装格式 →',
    boundaryEyebrow: '明确的项目边界', boundaryTitle: '内部是上游 Harness，外部是社区桌面宿主。',
    boundaryBody: 'DeepSeek Harness 提供智能体运行时、插件系统和 Web UI；本仓库提供 Electron 宿主、进程生命周期、暂存更新、诊断、托盘集成与原生安装包。',
    boundaryNotice: '这是社区维护的非官方项目，不是 DeepSeek 官方产品。', upstream: '上游 Harness', privacy: '隐私', support: '支持',
    downloadPromptEyebrow: '支持开源项目', downloadPromptTitle: '安装包已经准备好了。',
    downloadPromptDescription: '如果这个项目对你有帮助，欢迎在 GitHub 留下一颗 Star，让更多人发现它。',
    downloadPromptStar: '前往 GitHub Star 并下载', downloadPromptDirect: '直接下载，稍后再说',
    downloadPromptNote: '本站不会要求 GitHub 登录，也不会申请任何账户权限。', downloadPromptClose: '关闭下载提示',
  },
}

const languageButton = document.querySelector('.language-switch')

function setLanguage(language) {
  const selected = language === 'zh' ? 'zh' : 'en'
  document.documentElement.lang = selected === 'zh' ? 'zh-CN' : 'en'
  document.title = selected === 'zh' ? 'DeepSeek Harness 桌面版' : 'DeepSeek Harness Desktop'
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const value = copy[selected][element.dataset.i18n]
    if (value) element.innerHTML = value
  })
  document.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
    const value = copy[selected][element.dataset.i18nAriaLabel]
    if (value) element.setAttribute('aria-label', value)
  })
  languageButton.setAttribute('aria-pressed', String(selected === 'zh'))
  localStorage.setItem('dsh-desktop-language', selected)
}

const storedLanguage = localStorage.getItem('dsh-desktop-language')
const initialLanguage = storedLanguage || (navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en')
setLanguage(initialLanguage)

languageButton.addEventListener('click', () => {
  setLanguage(document.documentElement.lang === 'zh-CN' ? 'en' : 'zh')
})

const downloadPrompt = document.querySelector('#download-prompt')
const promptApi = globalThis.DeepSeekHarnessDownloadPrompt

if (typeof HTMLDialogElement === 'function'
  && downloadPrompt instanceof HTMLDialogElement
  && typeof downloadPrompt.showModal === 'function'
  && promptApi) {
  const startDownload = (url) => {
    const link = document.createElement('a')
    link.href = url
    link.hidden = true
    link.rel = 'noopener'
    document.body.append(link)
    link.click()
    link.remove()
  }

  const controller = promptApi.createDownloadPromptController({
    storage: localStorage,
    download: startDownload,
    openRepository: url => window.open(url, '_blank', 'noopener,noreferrer'),
  })

  document.querySelectorAll('a.button-download').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (!promptApi.shouldInterceptDownloadClick(event)) return
      event.preventDefault()
      if (controller.requestDownload(link.href)) downloadPrompt.showModal()
    })
  })

  downloadPrompt.querySelector('[data-download-action="star"]').addEventListener('click', () => {
    controller.chooseStarAndDownload()
    downloadPrompt.close()
  })

  downloadPrompt.querySelector('[data-download-action="direct"]').addEventListener('click', () => {
    controller.chooseDirectDownload()
    downloadPrompt.close()
  })

  downloadPrompt.querySelector('[data-download-action="close"]').addEventListener('click', () => {
    controller.cancel()
    downloadPrompt.close()
  })

  downloadPrompt.addEventListener('cancel', () => controller.cancel())
  downloadPrompt.addEventListener('click', (event) => {
    if (event.target !== downloadPrompt) return
    const bounds = downloadPrompt.getBoundingClientRect()
    if (!promptApi.isPointInsideRect(event, bounds)) {
      controller.cancel()
      downloadPrompt.close()
    }
  })
}
