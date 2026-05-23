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
 * Coverage scope:
 *   - Chrome (header, toolbar, sidebar nav, page loading)
 *   - Settings drawer (every section title + the new What's new /
 *     About / Mute notifications labels)
 *   - Welcome hero (pre-import)
 *   - Onboarding tour (3 steps)
 *   - Quick Tips floating button + Keyboard cheatsheet overlay
 *   - Trust hint tooltip body
 *   - **Data narratives** (round 2): WeekSummary headline + bullets,
 *     Day Audit narrative + comparisons, ActionFeed insight templates,
 *     anomaly explanations, budget banner messages, efficiency
 *     recommendations, burn-card captions. The renderer threads
 *     `useT()` into each builder via the `Translator` contract from
 *     `@cu/data`. Builders fall back to the English literal when no
 *     translator is passed (keeps the test suite + non-UI consumers
 *     like the markdown report exporter unchanged).
 *
 * Still English-only by design:
 *   - The exported local markdown report (Overview → Manage data →
 *     Download local report). Reports are artifacts users share with
 *     teammates / paste into issues, so a single canonical language
 *     keeps them grep-able. Switch by passing `t` from the call site
 *     if you ever want them localised.
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
  'settings.languageHint':
    'Switches every UI string and data narrative (week summary, day audit, anomaly explanations, action feed). Exported reports stay English.',
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

  // ─── Severity ──────────────────────────────────────────────────────
  // Shared closed-set vocabulary used in pills and badges (Anomalies
  // page, Action feed, etc). Kept short — these surfaces are dense.
  'severity.high': 'high',
  'severity.medium': 'medium',
  'severity.low': 'low',

  // ─── Overview · Week summary card ──────────────────────────────────
  'overview.week.aria': 'This week in a sentence',
  'overview.week.label': 'This week',
  'overview.week.noHistory': 'not enough history',
  'overview.week.daysOfDataSingular': '{n} day of data',
  'overview.week.daysOfDataPlural': '{n} days of data',

  // ─── Overview · Action feed ────────────────────────────────────────
  'overview.actionFeed.title': 'Action feed',
  'overview.actionFeed.subtitle': 'What changed, why it matters, and what to do first',
  'overview.actionFeed.localTag': 'local rules · no network',
  'overview.actionFeed.doFirst': 'do this first',
  'overview.actionFeed.nextAction': 'Next action',
  'overview.actionFeed.priority.high': 'high',
  'overview.actionFeed.priority.medium': 'medium',
  'overview.actionFeed.priority.low': 'low',
  'overview.actionFeed.confidence.high': 'high',
  'overview.actionFeed.confidence.medium': 'medium',
  'overview.actionFeed.confidence.low': 'low',
  'overview.actionFeed.confidenceWord': 'confidence',
  'overview.actionFeed.save': 'save',

  // ─── Overview · Efficiency card ────────────────────────────────────
  'overview.efficiency.title': 'Efficiency',
  'overview.efficiency.subtitle': 'Where can I trim?',
  'overview.efficiency.modelsScanned': '{n} models scanned',
  'overview.efficiency.yourCostPerReq': 'Your cost/req',
  'overview.efficiency.cheapestModel': 'cheapest model: {model} @ {cost}/req',
  'overview.efficiency.notEnoughData': 'not enough data yet',
  'overview.efficiency.cheapestSavings': 'Cheapest-mix savings',
  'overview.efficiency.noMaxSavings': 'No-max-mode savings',
  'overview.efficiency.pctOff': '{pct}% off current cost',
  'overview.efficiency.alreadyCheap': 'already at the cheap end',
  'overview.efficiency.maxModeOff': 'max-mode is off',

  // ─── Overview · Burn stories ───────────────────────────────────────
  'overview.burns.title': 'Top 5 burns',
  'overview.burns.subtitleWithBaseline':
    'Each request ≈ N regular Sonnet calls · baseline {baseline} / call (median Sonnet in this dataset)',
  'overview.burns.subtitleNoBaseline': 'No Sonnet baseline in this dataset',
  'overview.burns.hottest':
    'The hottest day was {date} — burned {cost} across {rows} rows. Below are the five single requests that cost the most in the past {days} days — each one tells its own token-mix story.',

  // ─── Budget urgency banner ─────────────────────────────────────────
  'budget.banner.severity.low': 'on the line',
  'budget.banner.severity.medium': 'heading over',
  'budget.banner.severity.high': 'budget at risk',
  'budget.banner.usedBudget': 'used / budget',
  'budget.banner.rate': 'rate',
  'budget.banner.rateValue': '{rate} req/day',
  'budget.banner.projected': 'projected',
  'budget.banner.runOut': 'run-out',
  'budget.banner.runOutValue': 'day {day}',
  'budget.banner.dismissAria': 'Dismiss budget banner for this session',

  // ─── Anomalies page ────────────────────────────────────────────────
  'anomalies.none.title': 'No anomalies detected',
  'anomalies.none.subtitle': 'Last 14-day baseline',
  'anomalies.none.body':
    'Everything in the loaded data falls within your usual envelope. We need at least 7 days of history to start scoring; load more data and try again, or adjust the look-back window in a future build.',
  'anomalies.section.costSpikes.title': 'Cost spikes',
  'anomalies.section.costSpikes.subtitle': 'Daily spend > 2.5 robust-Z or 5x median',
  'anomalies.section.cpr.title': 'Cost-per-request shifts',
  'anomalies.section.cpr.subtitle': '$/req > 3x your personal baseline (catches model switches)',
  'anomalies.section.cache.title': 'Cache hit drops',
  'anomalies.section.cache.subtitle': 'Hit ratio fell >= 10pp below baseline',
  'anomalies.section.flagged': '{n} flagged',
  'anomalies.section.empty': 'Nothing flagged in your loaded data.',
  'anomalies.summary.daysScanned': 'Days scanned',
  'anomalies.summary.anomalies': 'Anomalies',
  'anomalies.stat.cost': 'cost',
  'anomalies.stat.baseline': 'baseline',
  'anomalies.stat.signal': 'signal',
  'anomalies.stat.costPerReq': '$/req',
  'anomalies.stat.ratio': 'ratio',
  'anomalies.stat.topModel': 'top model',
  'anomalies.stat.today': 'today',
  'anomalies.stat.drop': 'drop',
  'anomalies.openDay': 'Open day',
  'anomalies.method.title': 'How this works',
  'anomalies.method.subtitle': 'Pure local stats',
  'anomalies.method.bullet1':
    '<<L>>Cost spike<</L>>: robust z-score (MAD) against the trailing 14 days. Falls back to a 5x median ratio when your history is perfectly flat so first-time bursts still surface.',
  'anomalies.method.bullet2':
    "<<L>>Cost-per-request<</L>>: today's $/req divided by your 14-day median. Caught when >= 3x and the day spent at least $5 to filter noise.",
  'anomalies.method.bullet3':
    "<<L>>Cache hit drop<</L>>: today's cache-read share vs trailing median, measured in percentage points. Days with under 1k input tokens are ignored.",
  'anomalies.method.bullet4':
    'All detectors run client-side over the loaded CSV. No data leaves your machine.',

  // ─── Data narrative · Week summary ─────────────────────────────────
  'narrative.weekSummary.noUsage': 'No usage data yet.',
  'narrative.weekSummary.noUsageRecent': 'No usage in the past 7 days.',
  'narrative.weekSummary.noUsageRecentSuggestion':
    'Import a more recent CSV or check that this dataset is current.',
  'narrative.weekSummary.headline.single':
    '{cost} this week across {models} model · top driver {topModel} ({sharePct}%).',
  'narrative.weekSummary.headline.multi':
    '{cost} this week across {models} models · top driver {topModel} ({sharePct}%).',
  'narrative.weekSummary.bullet.spendDelta':
    'Spend {dir} {pct}% vs prior 7 days ({prior} → {curr}).',
  'narrative.weekSummary.bullet.cacheHitDelta':
    'Cache hit ratio {pct}% {dir} {deltaPp}pp vs prior week.',
  'narrative.weekSummary.bullet.cacheHitStable': 'Cache hit ratio {pct}% (stable).',
  'narrative.weekSummary.bullet.maxMode': "Max-mode is {pct}% of this week's spend ({cost}).",
  'narrative.weekSummary.bullet.hottestDay': '{date} alone was {cost} — {sharePct}% of the week.',
  'narrative.weekSummary.suggestion.spendUp':
    'Spend is up {pct}% — open the Anomalies tab to see what changed.',
  'narrative.weekSummary.suggestion.maxModeHeavy':
    'Max-mode is driving {pct}% of this week — review whether every max request was necessary.',
  'narrative.weekSummary.suggestion.cacheDrop':
    'Cache hit ratio dropped {deltaPp}pp — new conversation patterns are bypassing cache.',
  'narrative.weekSummary.suggestion.topModelDominant':
    '{topModel} dominates {pct}% — check the Models page to see if a cheaper alternative fits.',

  // ─── Data narrative · Day Audit ────────────────────────────────────
  'narrative.dayAudit.todayLabel': 'Today ({date})',
  'narrative.dayAudit.weekday.sun': 'Sun',
  'narrative.dayAudit.weekday.mon': 'Mon',
  'narrative.dayAudit.weekday.tue': 'Tue',
  'narrative.dayAudit.weekday.wed': 'Wed',
  'narrative.dayAudit.weekday.thu': 'Thu',
  'narrative.dayAudit.weekday.fri': 'Fri',
  'narrative.dayAudit.weekday.sat': 'Sat',
  'narrative.dayAudit.referenceYesterday': 'yesterday ({date})',
  'narrative.dayAudit.referenceSameWeekday': '{weekday} a week ago ({date})',
  'narrative.dayAudit.empty':
    'No requests landed on {date}. Pick another date with the filter to start your audit.',
  'narrative.dayAudit.rowsSingular': '{n} request',
  'narrative.dayAudit.rowsPlural': '{n} requests',
  'narrative.dayAudit.spend': 'Spent {cost} across {rows}.',
  'narrative.dayAudit.topDriver': 'Top driver: {model} ({cost}, {sharePct}% of the day).',
  'narrative.dayAudit.biggest': 'Single biggest: {cost} at {time} on {model}.',
  'narrative.dayAudit.peak': 'Peak hour was {hour}:00 UTC.',
  'narrative.dayAudit.flat': 'Roughly flat vs yesterday — no surprise jump.',
  'narrative.dayAudit.up': 'Up {pct}% vs yesterday — worth a closer look.',
  'narrative.dayAudit.down': 'Down {pct}% vs yesterday.',

  // ─── Data narrative · Burn captions ────────────────────────────────
  'narrative.burn.outputHeavy': 'output-heavy · {pct}% generated by the model',
  'narrative.burn.warmCache': 'warm-cache rerun · {pct}% replayed from cache',
  'narrative.burn.coldCache': 'cold-cache build · {pct}% feeding the cache for the first time',
  'narrative.burn.freshInput': 'fresh input-heavy · {pct}% billed at the full input rate',
  'narrative.burn.balanced': 'balanced mix · {tokens}M tokens in one shot',
  'narrative.burn.maxMode': 'Max-mode 2× billing · {core}',

  // ─── Data narrative · Budget banner ────────────────────────────────
  'narrative.budget.safe': 'On track. {remaining} of {budget} requests remaining for the month.',
  'narrative.budget.exhausted':
    'Budget exhausted — {overBy} requests over with {daysRemaining} days left in the month.',
  'narrative.budget.willHit':
    "At {rate} requests/day you'll hit your {budget}-request budget on day {day} (in {daysToExhaustion} days), {daysBeforeMonthEnd} days before month-end.",
  'narrative.budget.projecting':
    'Projecting {projected} requests by month-end ({overPct}% over the {budget} budget) at the current pace.',

  // ─── Data narrative · Anomaly explanations ─────────────────────────
  'narrative.anomaly.spikeRatio':
    '{date} spent ${cost}, {ratio}x your usual baseline of ${baseline}.',
  'narrative.anomaly.spikeZ':
    '{date} spent ${cost}, {z} robust-z above the {window}-day baseline of ${baseline}.',
  'narrative.anomaly.cprShift':
    '{date} cost/request was ${cpr}, {ratio}x your baseline of ${baseline} (top model on this day: {topModel}).',
  'narrative.anomaly.cacheDrop':
    '{date} cache hit ratio dropped {dropPp}pp to {current}% (baseline {baseline}%).',

  // ─── Data narrative · Efficiency recommendations ───────────────────
  'narrative.efficiency.switchModel.title':
    'Consider switching half of {expensive} to {cheap} to save ~${savings}',
  'narrative.efficiency.switchModel.detail':
    '{expensive} cost ${expensiveCpr}/req vs {cheap} at ${cheapCpr}/req ({ratio}x cheaper). Routing routine work to the cheaper model unlocks the saving without changing the harder tasks.',
  'narrative.efficiency.dropMaxmode.title':
    'Max-mode is {pct}% of your spend — ~${savings} of that is the premium',
  'narrative.efficiency.dropMaxmode.detail':
    "You spent ${cost} with max-mode on. Max-mode typically costs 2-4x baseline; turning it off when you don't need the deep-thinking pass would save roughly {ratePct}% of those rows.",
  'narrative.efficiency.concentration.title': '{pct}% of spend is on {model} — single-model risk',
  'narrative.efficiency.concentration.detail':
    'Heavy single-model dependence makes you sensitive to price changes and outages. A modest fanout to a complementary model would shave ~${savings} and add resilience.',
  'narrative.efficiency.goodNews.title': 'No obvious efficiency wins — your mix is already lean',
  'narrative.efficiency.goodNews.detail':
    'Your spend is spread across reasonable $/req models with no large max-mode tax. Keep watching the anomaly inspector for surprise spikes.',

  // ─── Data narrative · Action feed (insights) ───────────────────────
  'narrative.insight.healthy.title': 'No urgent cost action in this dataset',
  'narrative.insight.healthy.detail':
    'Budget, anomalies, cache reuse, max-mode, and model mix all look calm enough for now.',
  'narrative.insight.healthy.action': 'Keep watching the weekly summary.',
  'narrative.insight.empty.title': 'Import usage data to get cost coaching',
  'narrative.insight.empty.detail':
    'The action feed appears after a CSV is loaded and enough usage exists to score.',
  'narrative.insight.empty.action': 'Import a Cursor usage CSV.',
  'narrative.insight.budget.titleHigh': 'Monthly request budget is at risk',
  'narrative.insight.budget.titleMedium': 'Monthly request budget is trending hot',
  'narrative.insight.budget.actionExhaustion': 'Audit high-cost days before day {day}.',
  'narrative.insight.budget.actionDefault': 'Review max-mode and model mix before the month ends.',
  'narrative.insight.anomaly.title': 'Investigate {date}',
  'narrative.insight.anomaly.action':
    'Open the Day audit for that date and inspect the request sequence.',
  'narrative.insight.efficiency.actionMaxmode':
    'Open Requests and filter max-mode-heavy days first.',
  'narrative.insight.efficiency.actionModel':
    'Open Models and compare the expensive model against cheaper routine-work options.',
  'narrative.insight.forecast.title': 'Next 30 days may rise {pct}%',
  'narrative.insight.forecast.detail':
    'The local linear forecast projects ${projected} over the next 30 days, versus ${current} in the latest 30-day window.',
  'narrative.insight.forecast.action':
    'Review the forecast panel and compare the latest high-cost week.',
  'narrative.insight.cache.title': 'Cache reuse looks low',
  'narrative.insight.cache.detail':
    'Only {pct}% of input tokens came from cache reads. Repeated long contexts may be landing cold.',
  'narrative.insight.cache.action':
    'Look for repeated workflows that could reuse warmed context or shorter prompts.',
  'narrative.insight.topBurn.title': 'One request cost ${cost}',
  'narrative.insight.topBurn.detail': '{model} on {date}.',
  'narrative.insight.topBurn.detailMaxMode': '{model} on {date} with max-mode enabled.',
  'narrative.insight.topBurn.action':
    'Open Day audit for that date and inspect the request sequence around it.',
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
  'settings.languageHint':
    '切换全部界面文字与数据叙事（本周总结、Day Audit、异常解释、动作建议）。导出的本地报告仍为英文。',
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

  // ─── Severity ──────────────────────────────────────────────────────
  'severity.high': '高',
  'severity.medium': '中',
  'severity.low': '低',

  // ─── Overview · Week summary card ──────────────────────────────────
  'overview.week.aria': '一句话本周总结',
  'overview.week.label': '本周',
  'overview.week.noHistory': '历史数据不足',
  'overview.week.daysOfDataSingular': '{n} 天数据',
  'overview.week.daysOfDataPlural': '{n} 天数据',

  // ─── Overview · Action feed ────────────────────────────────────────
  'overview.actionFeed.title': '动作建议',
  'overview.actionFeed.subtitle': '发生了什么变化、为什么重要、优先做哪件',
  'overview.actionFeed.localTag': '本地规则 · 无网络',
  'overview.actionFeed.doFirst': '先做这件',
  'overview.actionFeed.nextAction': '下一步',
  'overview.actionFeed.priority.high': '高',
  'overview.actionFeed.priority.medium': '中',
  'overview.actionFeed.priority.low': '低',
  'overview.actionFeed.confidence.high': '高',
  'overview.actionFeed.confidence.medium': '中',
  'overview.actionFeed.confidence.low': '低',
  'overview.actionFeed.confidenceWord': '置信度',
  'overview.actionFeed.save': '可省',

  // ─── Overview · Efficiency card ────────────────────────────────────
  'overview.efficiency.title': '效率',
  'overview.efficiency.subtitle': '哪里可以省？',
  'overview.efficiency.modelsScanned': '已扫描 {n} 个模型',
  'overview.efficiency.yourCostPerReq': '你的 cost/req',
  'overview.efficiency.cheapestModel': '最便宜模型：{model} @ {cost}/req',
  'overview.efficiency.notEnoughData': '数据还不够',
  'overview.efficiency.cheapestSavings': '换最便宜组合可省',
  'overview.efficiency.noMaxSavings': '关 max-mode 可省',
  'overview.efficiency.pctOff': '相对当前成本 {pct}%',
  'overview.efficiency.alreadyCheap': '已经在最便宜一端',
  'overview.efficiency.maxModeOff': 'max-mode 没开',

  // ─── Overview · Burn stories ───────────────────────────────────────
  'overview.burns.title': 'Top 5 单次烧钱',
  'overview.burns.subtitleWithBaseline':
    '每个请求 ≈ N 次普通 Sonnet 调用 · 基线 {baseline} / 次（数据集里 Sonnet 的中位）',
  'overview.burns.subtitleNoBaseline': '数据集里没有 Sonnet 基线',
  'overview.burns.hottest':
    '烧得最多的一天是 {date} —— 共 {cost}，{rows} 行。下面是过去 {days} 天里花费最多的五个单次请求 —— 每一个都讲了它自己的 token 组合故事。',

  // ─── Budget urgency banner ─────────────────────────────────────────
  'budget.banner.severity.low': '边缘试探',
  'budget.banner.severity.medium': '正在超出',
  'budget.banner.severity.high': '预算告急',
  'budget.banner.usedBudget': '已用 / 预算',
  'budget.banner.rate': '速率',
  'budget.banner.rateValue': '{rate} 请求/天',
  'budget.banner.projected': '预计',
  'budget.banner.runOut': '耗尽日',
  'budget.banner.runOutValue': '第 {day} 天',
  'budget.banner.dismissAria': '关闭本次会话的预算横幅',

  // ─── Anomalies page ────────────────────────────────────────────────
  'anomalies.none.title': '未检测到异常',
  'anomalies.none.subtitle': '基于过去 14 天基线',
  'anomalies.none.body':
    '加载的数据都在你日常的波动区间里。至少要有 7 天历史才能开始打分；加载更多数据再试一次，或者在未来版本里调整 look-back 窗口。',
  'anomalies.section.costSpikes.title': '花费突增',
  'anomalies.section.costSpikes.subtitle': '日花费 > 2.5 robust-Z 或 5x 中位',
  'anomalies.section.cpr.title': '单价突变',
  'anomalies.section.cpr.subtitle': '$/req > 个人基线的 3 倍（能抓住模型切换）',
  'anomalies.section.cache.title': '缓存命中下降',
  'anomalies.section.cache.subtitle': '命中率比基线下降 >= 10pp',
  'anomalies.section.flagged': '{n} 条命中',
  'anomalies.section.empty': '加载的数据里没有命中。',
  'anomalies.summary.daysScanned': '已扫描天数',
  'anomalies.summary.anomalies': '异常数',
  'anomalies.stat.cost': '花费',
  'anomalies.stat.baseline': '基线',
  'anomalies.stat.signal': '信号',
  'anomalies.stat.costPerReq': '$/req',
  'anomalies.stat.ratio': '倍数',
  'anomalies.stat.topModel': '主模型',
  'anomalies.stat.today': '当日',
  'anomalies.stat.drop': '下降',
  'anomalies.openDay': '打开当日',
  'anomalies.method.title': '原理',
  'anomalies.method.subtitle': '纯本地统计',
  'anomalies.method.bullet1':
    '<<L>>花费突增<</L>>：对过去 14 天做 robust z-score（MAD）。当历史完全平稳时回落到 5x 中位比例，让首次突增也能浮出。',
  'anomalies.method.bullet2':
    '<<L>>单价突变<</L>>：当日 $/req ÷ 14 天中位。当 ≥ 3x 且当日花费 ≥ $5 时命中（过滤噪声）。',
  'anomalies.method.bullet3':
    '<<L>>缓存命中下降<</L>>：当日 cache-read 占比 vs 滑动中位，单位是百分点。输入 token 不足 1k 的日子被忽略。',
  'anomalies.method.bullet4': '所有检测都在客户端基于加载的 CSV 计算，数据不离开你的机器。',

  // ─── Data narrative · Week summary ─────────────────────────────────
  'narrative.weekSummary.noUsage': '还没有用量数据。',
  'narrative.weekSummary.noUsageRecent': '过去 7 天没有用量。',
  'narrative.weekSummary.noUsageRecentSuggestion': '导入更新的 CSV，或确认这份数据是最新的。',
  'narrative.weekSummary.headline.single':
    '本周 {cost}，覆盖 {models} 个模型 · 主驱动 {topModel}（{sharePct}%）。',
  'narrative.weekSummary.headline.multi':
    '本周 {cost}，覆盖 {models} 个模型 · 主驱动 {topModel}（{sharePct}%）。',
  'narrative.weekSummary.bullet.spendDelta': '花费 {dir} {pct}%，相比前 7 天（{prior} → {curr}）。',
  'narrative.weekSummary.bullet.cacheHitDelta': '缓存命中 {pct}% {dir} {deltaPp}pp，相比上周。',
  'narrative.weekSummary.bullet.cacheHitStable': '缓存命中 {pct}%（稳定）。',
  'narrative.weekSummary.bullet.maxMode': 'Max-mode 占本周花费的 {pct}%（{cost}）。',
  'narrative.weekSummary.bullet.hottestDay': '{date} 一天就 {cost} —— 占本周的 {sharePct}%。',
  'narrative.weekSummary.suggestion.spendUp': '花费上升 {pct}% —— 打开 Anomalies 看看变化。',
  'narrative.weekSummary.suggestion.maxModeHeavy':
    'Max-mode 占了本周 {pct}% —— 复盘下是不是每个 max 请求都必要。',
  'narrative.weekSummary.suggestion.cacheDrop':
    '缓存命中下降了 {deltaPp}pp —— 新的对话模式正在绕过缓存。',
  'narrative.weekSummary.suggestion.topModelDominant':
    '{topModel} 占了 {pct}% —— 去 Models 看看有没有更便宜的替代。',

  // ─── Data narrative · Day Audit ────────────────────────────────────
  'narrative.dayAudit.todayLabel': '今天（{date}）',
  'narrative.dayAudit.weekday.sun': '周日',
  'narrative.dayAudit.weekday.mon': '周一',
  'narrative.dayAudit.weekday.tue': '周二',
  'narrative.dayAudit.weekday.wed': '周三',
  'narrative.dayAudit.weekday.thu': '周四',
  'narrative.dayAudit.weekday.fri': '周五',
  'narrative.dayAudit.weekday.sat': '周六',
  'narrative.dayAudit.referenceYesterday': '昨天（{date}）',
  'narrative.dayAudit.referenceSameWeekday': '上{weekday}（{date}）',
  'narrative.dayAudit.empty': '{date} 没有任何请求。用筛选器换一天开始审计。',
  'narrative.dayAudit.rowsSingular': '{n} 个请求',
  'narrative.dayAudit.rowsPlural': '{n} 个请求',
  'narrative.dayAudit.spend': '花费 {cost}，{rows}。',
  'narrative.dayAudit.topDriver': '主驱动：{model}（{cost}，占当日 {sharePct}%）。',
  'narrative.dayAudit.biggest': '单次最大：{cost}，{time} 由 {model} 发起。',
  'narrative.dayAudit.peak': '高峰小时是 {hour}:00 UTC。',
  'narrative.dayAudit.flat': '相比昨天基本持平 —— 没有意外跳升。',
  'narrative.dayAudit.up': '相比昨天上涨 {pct}% —— 值得仔细看看。',
  'narrative.dayAudit.down': '相比昨天下降 {pct}%。',

  // ─── Data narrative · Burn captions ────────────────────────────────
  'narrative.burn.outputHeavy': '产出密集型 · {pct}% 是模型生成',
  'narrative.burn.warmCache': '热缓存重放 · {pct}% 来自缓存命中',
  'narrative.burn.coldCache': '冷缓存填充 · {pct}% 是首次写入缓存',
  'narrative.burn.freshInput': '全新输入密集型 · {pct}% 按完整输入价计费',
  'narrative.burn.balanced': '均衡组合 · 一次 {tokens}M tokens',
  'narrative.burn.maxMode': 'Max-mode 2× 计费 · {core}',

  // ─── Data narrative · Budget banner ────────────────────────────────
  'narrative.budget.safe': '正常。本月预算 {budget} 请求，还剩 {remaining}。',
  'narrative.budget.exhausted': '预算已耗尽 —— 超出 {overBy} 请求，本月还剩 {daysRemaining} 天。',
  'narrative.budget.willHit':
    '当前速率 {rate} 请求/天，将在第 {day} 天耗尽 {budget} 请求预算（还有 {daysToExhaustion} 天），距月末还差 {daysBeforeMonthEnd} 天。',
  'narrative.budget.projecting':
    '按当前速率，预计月末达到 {projected} 请求（超出 {budget} 预算的 {overPct}%）。',

  // ─── Data narrative · Anomaly explanations ─────────────────────────
  'narrative.anomaly.spikeRatio': '{date} 花费 ${cost}，是常规基线 ${baseline} 的 {ratio}x。',
  'narrative.anomaly.spikeZ':
    '{date} 花费 ${cost}，比 {window} 天基线 ${baseline} 高 {z} robust-z。',
  'narrative.anomaly.cprShift':
    '{date} 单次成本 ${cpr}，是基线 ${baseline} 的 {ratio}x（当日主模型：{topModel}）。',
  'narrative.anomaly.cacheDrop':
    '{date} 缓存命中下降 {dropPp}pp，降到 {current}%（基线 {baseline}%）。',

  // ─── Data narrative · Efficiency recommendations ───────────────────
  'narrative.efficiency.switchModel.title': '把一半 {expensive} 切到 {cheap}，预计可省 ~${savings}',
  'narrative.efficiency.switchModel.detail':
    '{expensive} 是 ${expensiveCpr}/req，{cheap} 是 ${cheapCpr}/req（便宜 {ratio}x）。把日常任务路由到便宜模型，难任务不动，就能拿到这部分节省。',
  'narrative.efficiency.dropMaxmode.title':
    'Max-mode 占你花费的 {pct}% —— 其中约 ${savings} 是 max 溢价',
  'narrative.efficiency.dropMaxmode.detail':
    'Max-mode 开启花了 ${cost}。Max-mode 通常是基线的 2-4 倍；不需要深思考的时候关掉，能省下这些行约 {ratePct}%。',
  'narrative.efficiency.concentration.title': '{pct}% 花费集中在 {model} —— 单模型风险',
  'narrative.efficiency.concentration.detail':
    '过度依赖单个模型会让你对价格变化和故障敏感。少量分流到互补模型可以省下 ~${savings} 同时增强韧性。',
  'narrative.efficiency.goodNews.title': '没有明显的效率优化点 —— 你的组合已经很精简',
  'narrative.efficiency.goodNews.detail':
    '你的花费分散在 $/req 合理的模型上，没有大额 max-mode 税。继续盯 anomaly 检测器抓突发就好。',

  // ─── Data narrative · Action feed (insights) ───────────────────────
  'narrative.insight.healthy.title': '这份数据里没有紧急的成本动作',
  'narrative.insight.healthy.detail': '预算、异常、缓存复用、max-mode、模型组合目前看都还平稳。',
  'narrative.insight.healthy.action': '继续盯本周总结即可。',
  'narrative.insight.empty.title': '导入用量数据以获取成本建议',
  'narrative.insight.empty.detail': '加载 CSV 且有足够用量可以打分后，动作建议会出现在这里。',
  'narrative.insight.empty.action': '导入一份 Cursor usage CSV。',
  'narrative.insight.budget.titleHigh': '月度请求预算告急',
  'narrative.insight.budget.titleMedium': '月度请求预算偏热',
  'narrative.insight.budget.actionExhaustion': '在第 {day} 天之前审计高花费日。',
  'narrative.insight.budget.actionDefault': '月末前复盘 max-mode 和模型组合。',
  'narrative.insight.anomaly.title': '排查 {date}',
  'narrative.insight.anomaly.action': '打开该日的 Day audit，看请求序列。',
  'narrative.insight.efficiency.actionMaxmode': '打开 Requests，先筛 max-mode 重的日子。',
  'narrative.insight.efficiency.actionModel': '打开 Models，把贵模型和便宜的常规选项做对比。',
  'narrative.insight.forecast.title': '未来 30 天可能上涨 {pct}%',
  'narrative.insight.forecast.detail':
    '本地线性预测：未来 30 天约 ${projected}，相比最近 30 天的 ${current}。',
  'narrative.insight.forecast.action': '查看预测面板，与最近高花费的一周对比。',
  'narrative.insight.cache.title': '缓存复用率偏低',
  'narrative.insight.cache.detail':
    '只有 {pct}% 的输入 token 来自缓存读取。重复的长 context 可能没有命中缓存。',
  'narrative.insight.cache.action': '看看哪些重复工作流可以复用热 context 或更短的 prompt。',
  'narrative.insight.topBurn.title': '单次请求花了 ${cost}',
  'narrative.insight.topBurn.detail': '{date} 由 {model} 发起。',
  'narrative.insight.topBurn.detailMaxMode': '{date} 由 {model} 发起，max-mode 开启。',
  'narrative.insight.topBurn.action': '打开当日的 Day audit，看那个请求前后的序列。',
};

export const builtInDictionaries: Record<Locale, Dictionary> = {
  en: enDictionary,
  zh: zhDictionary,
};
