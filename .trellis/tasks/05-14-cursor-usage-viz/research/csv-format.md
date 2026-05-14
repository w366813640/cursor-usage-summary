# Cursor 导出 CSV 字段语义

> 数据源：用户从 cursor.com/dashboard/usage 导出的 `usage-events-2026-05-14.csv`
> 大小：267,854 bytes，2335 行（含 header）

## 字段表

| 列名 | 类型 | 示例 | 语义 |
|------|------|------|------|
| `Date` | ISO 8601 | `2026-05-13T09:33:42.386Z` | UTC 时间，毫秒精度 |
| `Cloud Agent ID` | string \| empty | `bc-0361eaea-75e6-41f5-a8e0-58755aeb9392` | Cloud Agent 任务 ID（仅 Cloud Agent 场景有） |
| `Automation ID` | string \| empty | 通常空 | Automation 任务 ID（罕见） |
| `Kind` | enum | `Included` / `Errored, No Charge` / `Aborted, Not Charged` / `Free` | 计费类型 |
| `Model` | string | `claude-opus-4-7-thinking-max` | 模型 ID（含 reasoning effort 后缀） |
| `Max Mode` | enum | `Yes` / `No` | 是否启用 Max Mode |
| `Input (w/ Cache Write)` | int \| empty | `791490` | 写入缓存的输入 token 量（按 cache write 价计费） |
| `Input (w/o Cache Write)` | int \| empty | `499887` | 不写缓存的输入 token 量（按 input 价计费） |
| `Cache Read` | int \| empty | `19954940` | 命中缓存的 token 量（按 cache read 价计费，最便宜） |
| `Output Tokens` | int \| empty | `232369` | 输出 token 量（按 output 价计费） |
| `Total Tokens` | int \| empty | `21478686` | 总 token 量 |
| `Requests` | string | `1` / `4` / `-` / `Free` | 计费请求数；`-` = 未计费，`Free` = 免费配额 |

## 关键观察

### 1. Kind 分布（2335 行）

```
Included            2215  (94.86%) — 正常计费
Errored, No Charge   117  ( 5.01%) — 出错不计费
Aborted, Not Charged   2  ( 0.09%) — 用户中止不计费
Free                   1  ( 0.04%) — 免费配额
```

**计费引擎**：只有 `Included` 行才计费。其他三种 token 量仍记录但不算钱。

### 2. Model 分布（36 个独特值，Top 15）

```
claude-4-sonnet-thinking            557
claude-4.5-sonnet-thinking          425
claude-4.6-opus-max-thinking        259  ⚠️ 6× 价
claude-3.7-sonnet-thinking          131
gpt-5-high                          113
gemini-2.5-pro-preview-05-06        113
auto                                 96
claude-4.5-opus-high-thinking        92
claude-opus-4-7-thinking-max         83  ⚠️ 6× 价
claude-opus-4-7-thinking-xhigh       78
claude-4-sonnet                      57
grok-code-fast-1                     48
claude-4.6-opus-high-thinking        36
composer-1.5                         34
gpt-5                                33
```

**模型名解码**：
- `-thinking` 后缀：thinking variant（在 legacy 计 2 requests，新版按 token 计）
- `-max` 后缀：Max Mode + Fast 系列（6× 价！）
- `-high`, `-xhigh`, `-medium` 后缀：reasoning effort（不影响价）
- `-fast` 后缀：fast mode（视模型不同，可能 +0% 或 2×/6×）
- `-preview-MM-DD`, `-exp-MM-DD` 后缀：preview / experimental

### 3. Token 量的极端分布

最大单次：`44599858` total tokens（44.6M！），claude-opus-4-7-thinking-max
最小单次：几百到几千 token

**单次成本估算**：
- 一条普通 `claude-opus-4-7-thinking-max` 请求（21M total）：
  - cache write: 791K × $37.5/M = $29.66
  - input: 500K × $30/M = $15
  - cache read: 19.9M × $3/M = $59.86
  - output: 232K × $150/M = $34.85
  - **= $139.37 单次**

也就是说一条 Max 请求可能等于普通 Sonnet 几百次的成本——**数据可视化必须凸显这种成本不对称**。

### 4. 时间跨度

- 起：~2026-03-16
- 止：~2026-05-13
- 约 60 天（不是完整 1 年，所以年度热力图要做"近 N 天"模式）

### 5. 数据缺失

- Cloud Agent ID 大多为空（仅 `Free` 那一行有值）
- Automation ID 几乎全空
- Errored/Aborted 行的 token 列**有值**，Requests 列为 `-`

## CSV 解析陷阱

1. **空字段**：用 `''` 表示，不是 `null`，需要 normalize 成 `null` 或 `0`
2. **千分位**：没有千分位逗号，纯数字字符串（好处）
3. **Requests 列**：可能是数字、`-`、`Free`，需要 union type 解析
4. **CSV 标准**：所有字段都加双引号包裹，包括数字
5. **行尾**：Windows CRLF（`\r\n`），需要 normalize

## 解析后的 TypeScript 类型

```ts
interface UsageRow {
  date: Date;                    // 解析自 ISO 字符串
  cloudAgentId: string | null;
  automationId: string | null;
  kind: 'Included' | 'Errored, No Charge' | 'Aborted, Not Charged' | 'Free';
  model: string;
  maxMode: boolean;
  inputWCacheWrite: number;      // 0 if empty
  inputWoCacheWrite: number;
  cacheRead: number;
  outputTokens: number;
  totalTokens: number;
  requests: number | 'free' | 'unbilled';
}
```
