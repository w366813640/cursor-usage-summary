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

/**
 * Resolve the dictionary for a locale. English is the source of truth
 * and stays in the main bundle (it's also the lookup fallback chain);
 * other locales live in their own lazy chunks so the default-locale
 * startup never parses them (perf plan 4.3).
 */
export async function loadDictionary(locale: Locale): Promise<Dictionary> {
  if (locale === 'zh') {
    const mod = await import('./dictionaries.zh');
    return mod.zhDictionary;
  }
  return enDictionary;
}
