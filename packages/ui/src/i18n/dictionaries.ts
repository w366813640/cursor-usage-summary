import type { Dictionary, Locale } from './types';

/**
 * Cursor Usage product dictionary.
 *
 * Design rules:
 *   - Keys are namespaced (`nav.*`, `chrome.*`, `settings.*`) so a
 *     consumer can mentally group strings without grepping.
 *   - English is the source of truth — translators (or future-me)
 *     start from `enDictionary` and produce `zhDictionary`. Missing
 *     keys in zh silently fall back to en (see I18nProvider).
 *   - `{var}` placeholders are interpolated by I18nProvider; values
 *     should match the variable's natural type in the source language
 *     (counts as numbers, model names as strings, etc).
 *   - Locale-aware number / date formatting still happens via
 *     `Intl.NumberFormat` / `Date.prototype.toLocaleString` — this
 *     dictionary intentionally doesn't ship localized format strings.
 *
 * Coverage scope (round 1):
 *   - Chrome (header, toolbar, sidebar nav, page loading)
 *   - Settings drawer (every section title + the new What's new /
 *     About / Mute notifications labels)
 *   - Welcome hero (pre-import)
 *   - Onboarding tour (3 steps)
 *   - Quick Tips floating button + Keyboard cheatsheet overlay
 *   - Trust hint tooltip body
 *
 * Out of scope (English-only for now):
 *   - Data-narrative output from `composeWeekSummary`, `ActionFeed`,
 *     `composeDayNarrative`, `Scenario planner`, anomaly explanations.
 *     These build sentences from row data and would need their own
 *     locale-aware sentence builder — a separate undertaking.
 */

export const enDictionary: Dictionary = {
  // ─── Common verbs / nouns ──────────────────────────────────────────
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.close': 'Close',
  'common.search': 'Search',
  'common.back': 'Back',
  'common.next': 'Next',
  'common.done': 'Done',
  'common.reset': 'Reset',
  'common.apply': 'Apply',
  'common.confirm': 'Confirm',
  'common.loading': 'Loading…',
  'common.retry': 'Retry',
  'common.skip': 'Skip',
  'common.show': 'Show',
  'common.hide': 'Hide',
  'common.new': 'new',

  // ─── App chrome ────────────────────────────────────────────────────
  'chrome.appName': 'Cursor Usage',
  'chrome.loadingRoute': 'Loading view…',
  'chrome.recoverableError': 'Recoverable renderer error',
  'chrome.recoverableErrorTitle': 'Cursor Usage hit a rendering problem.',
  'chrome.recoverableErrorBody':
    'Your local SQLite data was not modified. Reload the window to retry, or copy the message below when filing a support issue.',
  'chrome.reloadWindow': 'Reload window',

  // ─── Sidebar / navigation ──────────────────────────────────────────
  'nav.overview': 'Overview',
  'nav.year': 'Year review',
  'nav.anomalies': 'Anomalies',
  'nav.models': 'Models',
  'nav.details': 'All requests',
  'nav.day': 'Day audit',
  'nav.collapse': 'Collapse sidebar',
  'nav.expand': 'Expand sidebar',

  // ─── Toolbar (top of dashboard) ────────────────────────────────────
  'toolbar.focus': 'Focus',
  'toolbar.focusExit': 'Exit focus',
  'toolbar.focusTooltip': 'Hide secondary chrome (panels stay)',
  'toolbar.manageData': 'Manage data',
  'toolbar.manageDataTooltip': 'Open Settings → Data management',

  // ─── Welcome hero ──────────────────────────────────────────────────
  'welcome.title1': 'Know what Cursor cost,',
  'welcome.title2': 'and what to do next.',
  'welcome.subtitle':
    'Drop in a {code} exported from cursor.com/dashboard/usage. Cursor Usage turns it into a local cost coach: what happened, why it happened, and which habit saves the next dollar. Everything is computed on your device.',
  'welcome.drop': 'Drop CSV here or click to upload',
  'welcome.parsing': 'Parsing…',
  'welcome.dropHint':
    'Single {code}. You will preview new rows, skipped duplicates, and the covered date range before anything is saved.',
  'welcome.chooseCsv': 'Choose CSV',
  'welcome.storageHint': 'Storage · desktop · cursor-usage.db',
  'welcome.previewListHeader': "What you'll see after import",
  'welcome.previewLine1': 'A week-in-a-sentence summary above every metric',
  'welcome.previewLine2': 'Day Audit with an auto-narrative + biggest-spend jumper',
  'welcome.previewLine3': 'Local anomaly detector flags days that look unusual',
  'welcome.previewLine4': 'Models view with cache-hit + cost-per-request hygiene',

  // ─── Onboarding tour (3 steps) ─────────────────────────────────────
  'tour.skipAria': 'Skip tour',
  'tour.stepIndicator': 'step {current} / {total}',
  'tour.step1.title': 'Your usage dashboard',
  'tour.step1.body':
    'The headline cost, this-week summary, and the action feed live at the top of Overview. Anything urgent (budget breaches, anomalies) bubbles to the top of the same screen.',
  'tour.step2.title': 'Navigate fast',
  'tour.step2.body':
    'The left rail starts collapsed — click the bottom chevron to expand it. Press `?` anywhere to see every keyboard shortcut, or jump straight: g + o for Overview, g + h for Day audit, g + m for Models.',
  'tour.step3.title': 'Manage your data',
  'tour.step3.body':
    'Imports, history, redacted exports, the local report, and the navigation order all live in Settings → Data management. Open it any time with the "Manage data" button at the top-right or Cmd/Ctrl+, .',
  'tour.step3.cta': 'Got it',

  // ─── Quick Tips floating button ────────────────────────────────────
  'quickTips.aria': 'Quick tips and shortcuts',
  'quickTips.title': 'Quick tips · press ? for shortcuts',
  'quickTips.keyboard': 'Keyboard shortcuts',
  'quickTips.whatsNew': "What's new",

  // ─── Keyboard cheatsheet overlay ───────────────────────────────────
  'cheatsheet.title': 'Keyboard shortcuts',
  'cheatsheet.empty': 'No shortcuts registered yet.',
  'cheatsheet.group.navigation': 'Navigation',
  'cheatsheet.group.global': 'Global',
  'cheatsheet.group.editor': 'Editor',
  'cheatsheet.group.misc': 'Misc',

  // ─── Trust hint ────────────────────────────────────────────────────
  'trust.aria': 'How is this computed?',
  'trust.base':
    'Prices from Cursor docs · table snapshot {date}. All numbers computed locally from your CSV.',
  'trust.estimated':
    'Some rows used the Auto-pool fallback (model not in the table). Marked with an {badge} chip on the Details page.',
  'trust.estimatedBadge': 'est',

  // ─── Settings drawer ───────────────────────────────────────────────
  'settings.title': 'Settings',
  'settings.subtitle': 'Local-only preferences · saved per-machine',
  'settings.closeAria': 'Close settings',
  'settings.theme': 'Theme',
  'settings.themeHint': 'System follows your OS — light / dark force the choice.',
  'settings.theme.system': 'System',
  'settings.theme.light': 'Light',
  'settings.theme.dark': 'Dark',
  'settings.language': 'Language',
  'settings.languageHint': 'Affects the chrome only — data narratives stay in English for now.',
  'settings.language.en': 'English',
  'settings.language.zh': '简体中文',
  'settings.density': 'Density',
  'settings.densityHint': 'How airy the dashboard feels. Comfortable is the default.',
  'settings.density.comfortable': 'Comfortable',
  'settings.density.dense': 'Dense',
  'settings.density.presentation': 'Presentation',
  'settings.budget': 'Monthly request budget',
  'settings.budgetHint': 'Drives the plan cap displayed on the Overview → Monthly panel.',
  'settings.budget.unit': 'requests / month',
  'settings.budget.current': 'current persisted: {value} req/mo',
  'settings.budget.muteLabel': 'Mute budget notifications',
  'settings.budget.muteBody':
    "Mute OS toasts for the 80% / 100% budget thresholds. The tray label keeps updating either way — this just silences the popup so it stops nagging once you've acknowledged it.",
  'settings.dataManagement': 'Data management',
  'settings.dataManagement.import': 'Import a CSV',
  'settings.dataManagement.history': 'Open import history',
  'settings.dataManagement.redacted': 'Export redacted CSV',
  'settings.dataManagement.report': 'Download local report',
  'settings.navigation': 'Navigation',
  'settings.navigation.hint': 'Drag to reorder; eye toggle hides a route from rail + palette.',
  'settings.navigation.reset': 'reset to default',
  'settings.whatsNew': "What's new",
  'settings.whatsNew.hint': 'Release highlights for this build.',
  'settings.about': 'About',
  'settings.about.hint': 'No network, no telemetry. Everything stays on this machine.',
  'settings.about.version': 'Version',
  'settings.about.data': 'Data',
  'settings.about.dataWeb': 'browser storage (web preview)',
  'settings.about.license': 'License',
  'settings.about.licenseValue': 'MIT · local-first',
  'settings.backup': 'Backup & restore',
  'settings.backup.hint':
    'JSON export bundles every batch + row so you can replay on another machine.',
  'settings.backup.export': 'Export to .json',
  'settings.backup.restore': 'Restore from .json',
  'settings.backup.lastExport': 'last export: {when}',
  'settings.backup.noBackup': 'no backup taken yet',
  'settings.backup.confirmWarning':
    'Restoring will replace every batch + row currently in the database. Export a backup first if you\u2019re unsure.',
  'settings.backup.confirmReplace': 'Replace + restore',
};

export const zhDictionary: Dictionary = {
  // ─── Common verbs / nouns ──────────────────────────────────────────
  'common.cancel': '取消',
  'common.save': '保存',
  'common.delete': '删除',
  'common.close': '关闭',
  'common.search': '搜索',
  'common.back': '上一步',
  'common.next': '下一步',
  'common.done': '完成',
  'common.reset': '重置',
  'common.apply': '应用',
  'common.confirm': '确认',
  'common.loading': '加载中…',
  'common.retry': '重试',
  'common.skip': '跳过',
  'common.show': '显示',
  'common.hide': '隐藏',
  'common.new': '新',

  // ─── App chrome ────────────────────────────────────────────────────
  'chrome.appName': 'Cursor Usage',
  'chrome.loadingRoute': '正在加载视图…',
  'chrome.recoverableError': '可恢复的渲染错误',
  'chrome.recoverableErrorTitle': 'Cursor Usage 渲染出错了。',
  'chrome.recoverableErrorBody':
    '本地 SQLite 数据未受影响。重新加载窗口可重试；提交问题时附上下面这段信息即可。',
  'chrome.reloadWindow': '重新加载窗口',

  // ─── Sidebar / navigation ──────────────────────────────────────────
  'nav.overview': '总览',
  'nav.year': '年度回顾',
  'nav.anomalies': '异常检测',
  'nav.models': '模型',
  'nav.details': '全部请求',
  'nav.day': '日审计',
  'nav.collapse': '收起侧边栏',
  'nav.expand': '展开侧边栏',

  // ─── Toolbar ───────────────────────────────────────────────────────
  'toolbar.focus': '专注',
  'toolbar.focusExit': '退出专注',
  'toolbar.focusTooltip': '隐藏辅助 chrome（数据面板保留）',
  'toolbar.manageData': '管理数据',
  'toolbar.manageDataTooltip': '打开 设置 → 数据管理',

  // ─── Welcome hero ──────────────────────────────────────────────────
  'welcome.title1': '清楚 Cursor 花了多少，',
  'welcome.title2': '下一步该怎么做。',
  'welcome.subtitle':
    '把从 cursor.com/dashboard/usage 导出的 {code} 拖进来。Cursor Usage 会把它变成一个本地成本教练：发生了什么、为什么、哪个习惯能省下下一块钱。一切都在你的设备上算。',
  'welcome.drop': '把 CSV 拖到这里，或点击上传',
  'welcome.parsing': '解析中…',
  'welcome.dropHint': '单个 {code}。提交前会预览新增行 / 跳过重复 / 覆盖日期范围，确认后才落盘。',
  'welcome.chooseCsv': '选择 CSV',
  'welcome.storageHint': '存储 · 桌面 · cursor-usage.db',
  'welcome.previewListHeader': '导入后你会看到',
  'welcome.previewLine1': '每个指标顶部的「一句话本周总结」',
  'welcome.previewLine2': '带自动叙事 + 最大花费跳转的 Day Audit',
  'welcome.previewLine3': '本地异常检测器标记看起来异常的日子',
  'welcome.previewLine4': '模型页含 cache-hit 与 cost-per-request 的健康度',

  // ─── Onboarding tour ───────────────────────────────────────────────
  'tour.skipAria': '跳过引导',
  'tour.stepIndicator': '第 {current} / {total} 步',
  'tour.step1.title': '你的用量仪表盘',
  'tour.step1.body':
    '头条花费、本周总结、动作建议都在 Overview 顶部。任何紧急事项（预算超出、异常）都会冒到同一个屏幕的最上方。',
  'tour.step2.title': '快速导航',
  'tour.step2.body':
    '左侧导航栏默认收起 —— 点击底部的小箭头展开。任何时候按 ? 看全部键盘快捷键，或者直接跳：g+o 总览、g+h 日审计、g+m 模型。',
  'tour.step3.title': '管理数据',
  'tour.step3.body':
    '导入、历史、脱敏导出、本地报告、导航顺序都在 设置 → 数据管理。右上角的「管理数据」或 Cmd/Ctrl+, 可以随时打开。',
  'tour.step3.cta': '知道了',

  // ─── Quick Tips ────────────────────────────────────────────────────
  'quickTips.aria': '快速提示与快捷键',
  'quickTips.title': '快速提示 · 按 ? 看快捷键',
  'quickTips.keyboard': '键盘快捷键',
  'quickTips.whatsNew': '更新内容',

  // ─── Cheatsheet ────────────────────────────────────────────────────
  'cheatsheet.title': '键盘快捷键',
  'cheatsheet.empty': '还没有注册任何快捷键。',
  'cheatsheet.group.navigation': '导航',
  'cheatsheet.group.global': '全局',
  'cheatsheet.group.editor': '编辑',
  'cheatsheet.group.misc': '其他',

  // ─── Trust hint ────────────────────────────────────────────────────
  'trust.aria': '这个数字怎么算的？',
  'trust.base': '价格来自 Cursor 官方文档 · 价格表快照 {date}。所有数字基于你的 CSV 在本地计算。',
  'trust.estimated':
    '有些行用了 Auto-pool 兜底（模型不在价格表里）。在「全部请求」页用 {badge} 标识。',
  'trust.estimatedBadge': '估算',

  // ─── Settings drawer ───────────────────────────────────────────────
  'settings.title': '设置',
  'settings.subtitle': '本地偏好 · 按机器保存',
  'settings.closeAria': '关闭设置',
  'settings.theme': '主题',
  'settings.themeHint': '系统跟随 OS —— light / dark 强制锁定。',
  'settings.theme.system': '跟随系统',
  'settings.theme.light': '浅色',
  'settings.theme.dark': '深色',
  'settings.language': '语言',
  'settings.languageHint': '仅切换界面文案，数据叙事仍为英文。',
  'settings.language.en': 'English',
  'settings.language.zh': '简体中文',
  'settings.density': '密度',
  'settings.densityHint': '仪表盘的呼吸感。默认 Comfortable。',
  'settings.density.comfortable': '舒适',
  'settings.density.dense': '紧凑',
  'settings.density.presentation': '演示',
  'settings.budget': '月度请求预算',
  'settings.budgetHint': '驱动 Overview → 月度面板上的 plan cap。',
  'settings.budget.unit': '请求 / 月',
  'settings.budget.current': '当前保存：{value} 请求 / 月',
  'settings.budget.muteLabel': '静默预算通知',
  'settings.budget.muteBody':
    '静默 80% / 100% 预算阈值的系统通知。tray label 仍会更新 —— 这只是关掉弹窗，避免确认过后还反复 nag。',
  'settings.dataManagement': '数据管理',
  'settings.dataManagement.import': '导入 CSV',
  'settings.dataManagement.history': '打开导入历史',
  'settings.dataManagement.redacted': '导出脱敏 CSV',
  'settings.dataManagement.report': '下载本地报告',
  'settings.navigation': '导航',
  'settings.navigation.hint': '拖动调整顺序；眼睛图标隐藏某个路由（导航栏 + 命令面板都看不到）。',
  'settings.navigation.reset': '恢复默认',
  'settings.whatsNew': '更新内容',
  'settings.whatsNew.hint': '本版本的功能亮点。',
  'settings.about': '关于',
  'settings.about.hint': '无网络、无遥测。一切都留在这台机器上。',
  'settings.about.version': '版本',
  'settings.about.data': '数据',
  'settings.about.dataWeb': '浏览器存储（web 预览）',
  'settings.about.license': '许可',
  'settings.about.licenseValue': 'MIT · local-first',
  'settings.backup': '备份与恢复',
  'settings.backup.hint': 'JSON 导出包含全部 batch + row，可以在别的机器上重放。',
  'settings.backup.export': '导出为 .json',
  'settings.backup.restore': '从 .json 恢复',
  'settings.backup.lastExport': '上次导出：{when}',
  'settings.backup.noBackup': '尚未备份',
  'settings.backup.confirmWarning':
    '恢复将替换数据库里当前所有 batch + row。不放心的话先导一份备份。',
  'settings.backup.confirmReplace': '替换并恢复',
};

export const builtInDictionaries: Record<Locale, Dictionary> = {
  en: enDictionary,
  zh: zhDictionary,
};
