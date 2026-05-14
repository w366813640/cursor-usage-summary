# Cursor 官方模型定价（2026-05 最新）

> 来源：https://cursor.com/docs/models-and-pricing （2026-05-14 抓取）
> 单位：USD per 1,000,000 tokens

## Auto Pool 定价（特殊）

Auto 是 Cursor 自己挑模型的兜底通道，用固定费率：

| Token type | Price per 1M tokens |
|------------|---------------------|
| Input + Cache Write | $1.25 |
| Output | $6.00 |
| Cache Read | $0.25 |

**注意**：Auto pool 把 input 和 cache write 合并成一个费率，与 API pool 不同。

## API Pool 完整价格表

### Anthropic Claude

| Model | Input | Cache Write | Cache Read | Output | Notes |
|-------|------:|-----------:|-----------:|-------:|-------|
| Claude 4 Sonnet | $3 | $3.75 | $0.3 | $15 | Hidden by default; Thinking 在 legacy 计 2 requests |
| Claude 4 Sonnet 1M | $6 | $7.5 | $0.6 | $22.5 | 长上下文 2x；非常贵 |
| Claude 4.5 Haiku | $1 | $1.25 | $0.1 | $5 | |
| Claude 4.5 Opus | $5 | $6.25 | $0.5 | $25 | Max Mode 必需 |
| Claude 4.5 Sonnet | $3 | $3.75 | $0.3 | $15 | Max Mode 必需 |
| Claude 4.6 Opus | $5 | $6.25 | $0.5 | $25 | Max Mode 必需 |
| **Claude 4.6 Opus (Fast)** | **$30** | **$37.5** | **$3** | **$150** | **6× 普通价** |
| Claude 4.6 Sonnet | $3 | $3.75 | $0.3 | $15 | Max Mode 必需 |
| Claude 4.7 Opus | $5 | $6.25 | $0.5 | $25 | Max Mode 必需 |
| **Claude Opus 4.7 (Fast)** | **$30** | **$37.5** | **$3** | **$150** | **6× 普通价** |

### Cursor Composer

| Model | Input | Cache Write | Cache Read | Output | Notes |
|-------|------:|-----------:|-----------:|-------:|-------|
| Composer 1 | $1.25 | - | $0.125 | $10 | |
| Composer 1.5 | $3.5 | - | $0.35 | $17.5 | |
| Composer 2 | $0.5 | - | $0.2 | $2.5 | **极便宜** |

### OpenAI GPT-5 系列

| Model | Input | Cache Write | Cache Read | Output | Notes |
|-------|------:|-----------:|-----------:|-------:|-------|
| GPT-5 | $1.25 | - | $0.125 | $10 | reasoning effort: gpt-5-high |
| GPT-5 Fast | $2.5 | - | $0.25 | $20 | 2× 价 |
| GPT-5 Mini | $0.25 | - | $0.025 | $2 | |
| GPT-5-Codex | $1.25 | - | $0.125 | $10 | |
| GPT-5.1 Codex | $1.25 | - | $0.125 | $10 | |
| GPT-5.1 Codex Max | $1.25 | - | $0.125 | $10 | |
| GPT-5.1 Codex Mini | $0.25 | - | $0.025 | $2 | 4× rate limits |
| GPT-5.2 | $1.75 | - | $0.175 | $14 | gpt-5.2-high |
| GPT-5.2 Codex | $1.75 | - | $0.175 | $14 | |
| GPT-5.3 Codex | $1.75 | - | $0.175 | $14 | Max Mode 必需 |
| GPT-5.4 | $2.5 | - | $0.25 | $15 | 90% 缓存折扣；Fast +15% 速度 2× 价 |
| GPT-5.4 Mini | $0.75 | - | $0.075 | $4.5 | |
| GPT-5.4 Nano | $0.2 | - | $0.02 | $1.25 | |
| GPT-5.5 | $5 | - | $0.5 | $30 | Max Mode 必需 |

### Google Gemini

| Model | Input | Cache Write | Cache Read | Output | Notes |
|-------|------:|-----------:|-----------:|-------:|-------|
| Gemini 2.5 Flash | $0.3 | - | $0.03 | $2.5 | |
| Gemini 3 Flash | $0.5 | - | $0.05 | $3 | |
| Gemini 3 Pro | $2 | - | $0.2 | $12 | |
| Gemini 3 Pro Image Preview | $2 | - | $0.2 | $12 | + 图像输出 $120/1M |
| Gemini 3.1 Pro | $2 | - | $0.2 | $12 | |

### xAI Grok

| Model | Input | Cache Write | Cache Read | Output | Notes |
|-------|------:|-----------:|-----------:|-------:|-------|
| Grok 4.20 | $2 | - | $0.2 | $6 | >200k 输入 2× 价 |
| Grok 4.3 | $1.25 | - | $0.2 | $2.5 | Max Mode 必需 |

### Moonshot Kimi

| Model | Input | Cache Write | Cache Read | Output | Notes |
|-------|------:|-----------:|-----------:|-------:|-------|
| Kimi K2.5 | $0.6 | - | $0.1 | $3 | |

## CSV 模型名 → 定价表对照（待精确映射）

CSV 中出现的实际模型名（来自用户数据）：

| CSV 中的模型名 | 计费表里对应 | 备注 |
|---------------|------------|------|
| auto | Auto pool | 特殊 |
| composer-1 | Composer 1 | |
| composer-1.5 | Composer 1.5 | |
| composer-2, composer-2-fast | Composer 2 | fast 版本是否有溢价待查 |
| code-supernova, code-supernova-1-million | ? | 不在公开价格表中，可能是 Composer/preview |
| claude-3.7-sonnet, claude-3.7-sonnet-thinking | 旧版 Sonnet（已退役？）| 按 Claude 4 Sonnet 价或单独查 legacy 表 |
| claude-4-sonnet, claude-4-sonnet-thinking | Claude 4 Sonnet | thinking 在 legacy 计 2 req |
| claude-4.1-opus-thinking | ? Claude 4.1 Opus | 不在当前价格表中，可能已并入 4.5/4.6 |
| claude-4.5-haiku-thinking | Claude 4.5 Haiku | |
| claude-4.5-sonnet, claude-4.5-sonnet-thinking | Claude 4.5 Sonnet | |
| claude-4.5-opus-high-thinking | Claude 4.5 Opus | high 标识只是 reasoning effort |
| claude-4.6-opus-high-thinking | Claude 4.6 Opus | |
| claude-4.6-opus-max-thinking | Claude 4.6 Opus (Fast) | **6× 价** |
| claude-4.6-sonnet-medium-thinking | Claude 4.6 Sonnet | |
| claude-opus-4-7-thinking-xhigh | Claude 4.7 Opus | xhigh 是 reasoning effort |
| claude-opus-4-7-thinking-max | Claude Opus 4.7 (Fast) | **6× 价** |
| gpt-4o | 旧 OpenAI 模型 | 不在当前价格表，按 legacy GPT-4o 估 |
| gpt-5, gpt-5-high, gpt-5-fast | GPT-5 / GPT-5 Fast | |
| gpt-5.1-codex-high, gpt-5.1-codex-high-fast | GPT-5.1 Codex / Codex Fast | |
| gpt-5.3-codex-xhigh-fast | GPT-5.3 Codex Fast | |
| gpt-5.5-medium, gpt-5.5-extra-high-fast | GPT-5.5 | |
| gemini-2.5-pro-exp-03-25, gemini-2.5-pro-preview-05-06 | 旧 Gemini 2.5 Pro 预览 | 估按 Gemini 2.5 Flash 或单独查 |
| gemini-3-pro, gemini-3-pro-preview | Gemini 3 Pro | |
| gemini-3.1-pro | Gemini 3.1 Pro | |
| grok-code-fast-1 | ? Grok Code Fast | 不在当前公开价格表，可能 legacy |

**未匹配模型的兜底策略**：用 Auto pool 价格做"未知模型"的占位估算，并在 UI 上标"价格估算"角标。

## 计算公式

```ts
function calcCost(row: UsageRow, pricing: ModelPricing): number {
  // 单位都换成 $/1M tokens
  const inputCost = (row.inputWoCacheWrite ?? 0) * pricing.input / 1_000_000;
  const cacheWriteCost = (row.inputWCacheWrite ?? 0) * pricing.cacheWrite / 1_000_000;
  const cacheReadCost = (row.cacheRead ?? 0) * pricing.cacheRead / 1_000_000;
  const outputCost = (row.outputTokens ?? 0) * pricing.output / 1_000_000;
  return inputCost + cacheWriteCost + cacheReadCost + outputCost;
}
```

**注意 CSV 字段语义**：
- `Input (w/ Cache Write)` → 实际是 cache write 的那部分 token 量（按 cacheWrite 价）
- `Input (w/o Cache Write)` → 不带 cache 的普通输入 token 量（按 input 价）
- `Cache Read` → 命中缓存的 token 量（按 cacheRead 价，最便宜）
- `Output Tokens` → 输出 token 量（按 output 价）
- `Total Tokens` = 上述四者之和（用于校验）

**Errored / Aborted / Free 行不计费**——CSV 中 `Requests` 列会显示 `-` 或 `Free`。

## 已知陷阱

1. **legacy 模型不在新价格表里**（claude-3.7、gpt-4o、gemini-2.5-pro-exp 等）→ 需要单独维护一张 legacy 价格表
2. **fast 后缀的歧义**：composer-2-fast 是 Composer 2 同价，但 claude-4.6-opus-max-thinking 的 max 等于 Fast Mode 6× 价
3. **Max Mode 的 token 折算**：Cursor 文档说 token 价同普通版（不是 surcharge），只是上下文窗口扩大
4. **legacy plan 的 Max Mode 加 20% surcharge**（如果用户是老订阅可能不准）
