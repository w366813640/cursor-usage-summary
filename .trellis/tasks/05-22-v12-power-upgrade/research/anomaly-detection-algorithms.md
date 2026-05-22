# Anomaly Detection 算法选型

> 用于 PR2 `#anomalies` 路由。约束：**纯本地实现，TS，零外部依赖，覆盖 unit test**。

## 我们要检测什么

| Detector | Input | Anomaly 例子 |
|---|---|---|
| **Cost spike** | `byDay: {date, cost}[]` | 昨天 $80, 7d 均 $20 → 4× 跳变 |
| **Cost-per-request shift** | `rows: RowWithCost[]` aggregated by day | 用户切到 `claude-opus-max-thinking` → $/req 从 $0.34 跳到 $1.45 |
| **Cache hit ratio drop** | `byDay: {date, cacheHitRatio}[]` | 月 hit ratio 88% → 62%，pp drop ≥ 15 |

## 算法选型

### 1. Z-Score (经典)

公式：`z = (x - μ) / σ`

```ts
function zScore(values: number[]): number[] {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  const stdev = Math.sqrt(variance);
  if (stdev === 0) return values.map(() => 0);
  return values.map((v) => (v - mean) / stdev);
}
```

**优点**：直观、文献认可、cursor-usage-tracker 默认用
**缺点**：对 outlier 敏感（一个极端值会拉 μ 和 σ，掩盖小的真异常）

**用在哪**：Cost spike（结合 trim 5% top/bottom 缓解）

### 2. MAD (Median Absolute Deviation) — robust z-score

公式：
- `median(x)` = 中位数
- `MAD = median(|x - median(x)|)`
- `robust_z = 0.6745 * (x - median) / MAD`（0.6745 是为了让 MAD 在正态分布下等价于 σ）

```ts
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return 0;
  if (n % 2 === 0) return (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
  return sorted[(n - 1) / 2]!;
}

function robustZScore(values: number[]): number[] {
  const med = median(values);
  const absDev = values.map((v) => Math.abs(v - med));
  const mad = median(absDev);
  if (mad === 0) return values.map(() => 0);
  return values.map((v) => (0.6745 * (v - med)) / mad);
}
```

**优点**：对 outlier robust（中位数不被极端值拉动）
**缺点**：MAD 为 0 时退化（当 ≥ 50% 数据点完全一样时）

**用在哪**：所有三个 detector 的"严格模式"

### 3. Personal Baseline Multiplier (cursor-usage-tracker 的 "spend spike" 算法)

```
isAnomaly = (today / personalAvg7d) > N倍 (default 5×)
AND today >= minAbsoluteThreshold ($5 默认)
```

**优点**：直观、用户可解释（"是你平时的 5 倍"）
**缺点**：不带统计置信度

**用在哪**：作为 "easy-to-explain" 备选检测器，narrative 友好

## 推荐组合

```ts
type Anomaly =
  | { kind: 'cost-spike'; date: string; cost: number; zScore: number; baselineAvg: number; severity: Severity }
  | { kind: 'costperreq-shift'; date: string; current: number; baseline: number; ratio: number; topModel: string; severity: Severity }
  | { kind: 'cache-drop'; date: string; current: number; baseline: number; dropPp: number; severity: Severity };

type Severity = 'low' | 'medium' | 'high';

function detectCostSpikes(
  byDay: { date: string; cost: number }[],
  opts: { zScoreThreshold?: number; window?: number; minCost?: number } = {}
): Anomaly[] {
  const { zScoreThreshold = 2.5, window = 7, minCost = 5 } = opts;
  // ...
}
```

### Severity 分级

| 阈值 | low | medium | high |
|---|---|---|---|
| **cost-spike** zScore | 2.0-2.5 | 2.5-3.5 | > 3.5 |
| **cost/req shift** ratio | 2.0-3.0× | 3.0-5.0× | > 5.0× |
| **cache drop** pp | 10-15 | 15-25 | > 25 |

## Simulate 功能（PostHog 启发）

UI 上提供阈值 slider，实时算 "在历史数据上会标多少个异常点"，让用户对感受调参。

```ts
function simulateDetector<T>(
  data: T[],
  detector: (data: T[], opts: any) => Anomaly[],
  optsRange: { from: number; to: number; step: number; key: string }
): Array<{ threshold: number; anomalyCount: number }> {
  const results = [];
  for (let t = optsRange.from; t <= optsRange.to; t += optsRange.step) {
    const anomalies = detector(data, { [optsRange.key]: t });
    results.push({ threshold: t, anomalyCount: anomalies.length });
  }
  return results;
}
```

## Narrative 生成

每个 Anomaly 都自动生成 human-readable 解释：

```ts
function narrate(a: Anomaly): string {
  switch (a.kind) {
    case 'cost-spike':
      return `${a.date} spent $${a.cost.toFixed(2)}, ${a.zScore.toFixed(1)}σ above your ${a.baselineAvg.toFixed(2)} avg`;
    case 'costperreq-shift':
      return `${a.date} cost/request was $${a.current.toFixed(2)}, ${a.ratio.toFixed(1)}× your baseline of $${a.baseline.toFixed(2)} (likely ${a.topModel} switch)`;
    case 'cache-drop':
      return `${a.date} cache hit ratio dropped ${a.dropPp.toFixed(0)}pp to ${(a.current * 100).toFixed(0)}% from baseline ${(a.baseline * 100).toFixed(0)}%`;
  }
}
```

## 性能预算

- byDay 最多 365×3 = 1095 days（3 年数据），三个 detector 全跑应在 < 50ms
- rows 最多 100k+，cost-per-req detector 要先 group by day 再算，O(n) 单次扫
- 全部在主线程同步算，不需要 Web Worker

## 单测覆盖

- 空数据返回 []
- 全部 0 的输入返回 []
- 单个 outlier 被检出（z-score ≥ threshold）
- mean drift 不被误报（缓慢上升不算 spike）
- multimodal 数据（两个 peak）每个都检出
- 边界：MAD = 0 时不 NaN
- severity 分级在边界点正确

## 参考资料

- PostHog Anomaly Detection: 13 algorithms supported (Z-score, MAD, Isolation Forest, etc.)
- cursor-usage-tracker README: spend spike multiplier 5×, cycle outlier 10×, cost/req spike 3×
- 经典文献：Hampel 1974 "The Influence Curve and Its Role in Robust Estimation"
  → MAD 在金融时序异常检测里是 gold standard
