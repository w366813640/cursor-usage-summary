import {
  type RowWithCost,
  type UsageSummary,
  computeActionInsights,
  computeBudgetScenarios,
  redactedFileName,
} from '@cu/data';

/**
 * Privacy-safe markdown report writer. Used by the "Export Report"
 * affordance under Settings → Data management; mirrors the inline
 * helper that used to live in FileToolbar before the UI polish pass
 * moved the exports into Settings.
 *
 * The report contains aggregated metrics, top recommended actions,
 * and planning scenarios — but never raw CSV rows, Cloud Agent IDs,
 * Automation IDs, prompt text, or DB contents. Keep that contract
 * intact when extending this helper.
 */
export function buildLocalReport(args: {
  summary: UsageSummary;
  rows: ReadonlyArray<RowWithCost>;
  fileName: string;
  monthlyRequestBudget: number;
}): string {
  const { summary, rows, fileName, monthlyRequestBudget } = args;
  const insights = computeActionInsights(summary, rows, { monthlyRequestBudget }).slice(0, 5);
  const scenarios = computeBudgetScenarios(summary, rows, { monthlyRequestBudget }).slice(0, 4);
  const lines = [
    '# Cursor Usage Local Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Source: ${redactedFileName(fileName)}`,
    '',
    '## Summary',
    '',
    `- Date range: ${summary.dateRange.firstISO?.slice(0, 10) ?? 'n/a'} to ${
      summary.dateRange.lastISO?.slice(0, 10) ?? 'n/a'
    }`,
    `- Rows: ${summary.totalRows.toLocaleString()}`,
    `- Request units: ${Math.round(summary.totalRequestUnits).toLocaleString()}`,
    `- Estimated cost: ${formatUSD(summary.totalCost)}`,
    `- Cache hit ratio: ${(summary.cacheHitStats.hitRatio * 100).toFixed(0)}%`,
    '',
    '## Recommended Actions',
    '',
    ...insights.flatMap((insight) => [
      `- ${insight.title} (${insight.priority}, ${insight.confidence} confidence)`,
      `  - Detail: ${insight.detail}`,
      `  - Action: ${insight.action}`,
      `  - Source: ${insight.source}`,
    ]),
    '',
    '## Planning Scenarios',
    '',
    ...scenarios.flatMap((scenario) => [
      `- ${scenario.title} (${scenario.confidence} confidence)`,
      `  - Projected: ${formatUSD(scenario.projectedCost)} · ${Math.round(
        scenario.projectedRequests,
      ).toLocaleString()} request units`,
      `  - Delta: ${formatUSD(scenario.costDelta)} · ${Math.round(
        scenario.requestDelta,
      ).toLocaleString()} request units`,
      `  - Action: ${scenario.action}`,
    ]),
    '',
    '## Privacy',
    '',
    'This report omits raw CSV rows, Cloud Agent IDs, Automation IDs, prompt text, and database contents.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

/**
 * Trigger an in-browser download of `content`. Lives here (and not on
 * FileToolbar) so both Settings → Data management and any future
 * "Export…" buttons can reuse the same blob handling.
 */
export function triggerDownload(content: string, fileName: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatUSD(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}
