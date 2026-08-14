'use strict'

const zh = navigator.language.toLowerCase().startsWith('zh')
const strings = zh ? {
  title: '桌面控制中心', subtitle: '运行健康、更新、诊断与本地偏好', desktop: '桌面外壳', checkDesktop: '检查桌面应用更新',
  checkHarness: '检查 Harness 更新', restart: '重启', preferences: '偏好设置', closeToTray: '关闭窗口后继续运行',
  notifications: '桌面通知', openAtLogin: '开机启动', localData: '本地数据', dataDirectory: '应用数据', logDirectory: '桌面日志', open: '打开',
  operations: '运行状态', operationsHint: '受管本地 Harness 进程的实时状态', endpoint: '本地端点', runtimeSource: '运行时来源', process: '进程',
  taskEvents: '任务事件流', activeTasks: '活动任务', recovery: '崩溃恢复', system: '系统', diagnostics: '诊断',
  diagnosticsHint: '导出有界且已脱敏的支持包，不包含会话、凭据或工作区文件。', exportDiagnostics: '导出诊断包', bundled: '安装包内置', managed: '后台更新版本', stopped: '未运行',
} : {
  title: 'Desktop Control Center', subtitle: 'Runtime health, updates, diagnostics, and local preferences', desktop: 'Desktop shell', checkDesktop: 'Check desktop update',
  checkHarness: 'Check Harness update', restart: 'Restart', preferences: 'Preferences', closeToTray: 'Keep running when the window closes',
  notifications: 'Desktop notifications', openAtLogin: 'Start at login', localData: 'Local data', dataDirectory: 'Application data', logDirectory: 'Desktop logs', open: 'Open',
  operations: 'Operations', operationsHint: 'Live state from the managed local Harness process', endpoint: 'Local endpoint', runtimeSource: 'Runtime source', process: 'Process',
  taskEvents: 'Task event stream', activeTasks: 'Active tasks', recovery: 'Crash recovery', system: 'System', diagnostics: 'Diagnostics',
  diagnosticsHint: 'Export a bounded, redacted support bundle without sessions, credentials, or workspace files.', exportDiagnostics: 'Export diagnostic bundle', bundled: 'Bundled', managed: 'Background update', stopped: 'Stopped',
}
for (const element of document.querySelectorAll('[data-i18n]')) element.textContent = strings[element.dataset.i18n]
const $ = selector => document.querySelector(selector)
const phases = zh ? {
  starting: '启动中', running: '运行中', recovering: '正在恢复', error: '异常', idle: '等待检查', disabled: '未启用', checking: '正在检查', current: '已是最新', downloading: '正在下载', installing: '正在安装', verifying: '正在验证', prepared: '等待重启', ready: '已准备', connecting: '正在连接', connected: '已连接', reconnecting: '正在重连', stopped: '已停止', exporting: '正在导出',
} : {
  starting: 'Starting', running: 'Running', recovering: 'Recovering', error: 'Error', idle: 'Waiting', disabled: 'Disabled', checking: 'Checking', current: 'Up to date', downloading: 'Downloading', installing: 'Installing', verifying: 'Verifying', prepared: 'Restart pending', ready: 'Ready', connecting: 'Connecting', connected: 'Connected', reconnecting: 'Reconnecting', stopped: 'Stopped', exporting: 'Exporting',
}

function updateView(snapshot) {
  const desktop = snapshot.desktop.updates
  const harness = snapshot.harness.updates
  $('#desktop-version').textContent = `v${snapshot.desktop.version}`
  $('#desktop-badge').textContent = phases[desktop.phase] ?? desktop.phase
  $('#desktop-status').textContent = desktop.availableVersion
    ? (zh ? `v${desktop.availableVersion} 已下载，将在正常退出后安装。` : `v${desktop.availableVersion} is downloaded and will install after a normal quit.`)
    : (phases[desktop.phase] ?? desktop.phase)
  $('#check-desktop').disabled = !desktop.enabled || ['checking', 'downloading', 'ready'].includes(desktop.phase)
  $('#harness-version').textContent = harness.currentVersion ?? '—'
  $('#harness-badge').textContent = phases[snapshot.harness.lifecycle.phase] ?? snapshot.harness.lifecycle.phase
  $('#harness-status').textContent = harness.pendingVersion
    ? (zh ? `${harness.pendingVersion} 将在重启后启用。` : `${harness.pendingVersion} will activate after restart.`)
    : (phases[harness.phase] ?? harness.phase)
  $('#check-harness').disabled = ['checking', 'downloading', 'prepared'].includes(harness.phase)
  const lifecycle = snapshot.harness.lifecycle
  const processState = snapshot.harness.process
  const monitor = snapshot.harness.monitor
  const recovery = snapshot.harness.recovery
  const runtime = snapshot.harness.runtime
  $('#overall-status').textContent = phases[lifecycle.phase] ?? lifecycle.phase
  $('#overall-status').dataset.phase = lifecycle.phase
  $('#runtime-endpoint').textContent = runtime.endpoint ?? '—'
  $('#runtime-source').textContent = strings[runtime.source] ?? runtime.source ?? '—'
  $('#runtime-process').textContent = processState.running
    ? (processState.pid === undefined ? (zh ? '运行中' : 'Running') : `PID ${processState.pid}`)
    : strings.stopped
  $('#task-monitor').textContent = phases[monitor.phase] ?? monitor.phase
  $('#active-tasks').textContent = String(monitor.runningSessions ?? 0)
  $('#recovery-state').textContent = zh
    ? `${recovery.attempts ?? 0}/${recovery.maxAttempts ?? 3} 次${recovery.pending ? ' · 等待重试' : ''}`
    : `${recovery.attempts ?? 0}/${recovery.maxAttempts ?? 3} attempts${recovery.pending ? ' · retry pending' : ''}`
  const system = snapshot.system
  $('#system-state').textContent = `${system.platform ?? '—'} ${system.arch ?? ''} · Electron ${system.electron ?? '—'} · Node ${system.node ?? '—'}`
  const diagnostics = snapshot.diagnostics
  $('#diagnostic-status').textContent = diagnostics.filename
    ? (zh ? `已生成 ${diagnostics.filename}` : `Created ${diagnostics.filename}`)
    : diagnostics.error
      ? diagnostics.error
      : strings.diagnosticsHint
  $('#export-diagnostics').disabled = diagnostics.phase === 'exporting'
  $('#export-diagnostics').textContent = diagnostics.phase === 'exporting'
    ? (phases.exporting ?? strings.exportDiagnostics)
    : strings.exportDiagnostics
  $('#close-to-tray').checked = snapshot.preferences.closeToTray
  $('#notifications').checked = snapshot.preferences.notifications
  $('#open-at-login').checked = snapshot.preferences.openAtLogin
  $('#open-at-login-row').hidden = !snapshot.capabilities.loginItem
  $('#data-path').textContent = snapshot.paths.data
  $('#log-path').textContent = snapshot.paths.logs
}

async function act(callback) {
  $('#error').hidden = true
  try { await callback() } catch (error) {
    $('#error').textContent = error.message
    $('#error').hidden = false
  }
}

$('#check-desktop').addEventListener('click', () => act(() => window.desktopCenter.checkDesktopUpdate()))
$('#check-harness').addEventListener('click', () => act(() => window.desktopCenter.checkHarnessUpdate()))
$('#restart-harness').addEventListener('click', () => act(() => window.desktopCenter.restartHarness()))
$('#export-diagnostics').addEventListener('click', () => act(() => window.desktopCenter.exportDiagnostics()))
$('#open-data').addEventListener('click', () => act(() => window.desktopCenter.openDirectory('data')))
$('#open-logs').addEventListener('click', () => act(() => window.desktopCenter.openDirectory('logs')))
for (const [selector, key] of [['#close-to-tray', 'closeToTray'], ['#notifications', 'notifications'], ['#open-at-login', 'openAtLogin']]) {
  $(selector).addEventListener('change', event => act(() => window.desktopCenter.setPreference(key, event.target.checked)))
}
window.desktopCenter.onSnapshot(updateView)
void act(async () => updateView(await window.desktopCenter.snapshot()))
