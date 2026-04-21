---
name: bench-provider
description: >
  Benchmark one or more providers through the gateway — latency,
  tokens/second, cost per completion, and streaming first-byte-time.
  Trigger when the user says "benchmark X", "compare providers", "is
  provider Y fast enough?", "measure TTFT for …", or wants numbers for a
  blog/docs post.
---

# Bench Provider

Produce apples-to-apples numbers for providers routed through the gateway.
Does NOT modify code.

## Step 0: Gather info

- **Targets** — list of `provider/model` slugs. Default: read `.env` and
  pick one model per configured provider (cheapest).
- **Prompt** — the caller's prompt, OR default: a 50-token standard prompt.
- **Iterations** — default 5 per target (warm + 4 timed).
- **Streaming?** — default: run both streaming and non-streaming.

## Step 1: Prerequisites

- Gateway running on `:4000` (`curl -sf /health`). If not, start it with
  `bun run dev` in the background and poll until ready.
- An admin API key exists. If not, `make create-key`.

## Step 2: Warm-up

Send one untimed request per target to prime caches/keepalive.

## Step 3: Timed runs

For each target × mode (streaming, non-streaming) × iteration:

- Measure `total_latency_ms` via `time curl -w '%{time_total}'` or
  `performance.now()` from a `.mjs` script.
- For streaming, also capture **TTFT** (time-to-first-byte of the first SSE
  `data:` event).
- Pull the cost from `X-Summoned-Cost-USD` response header. Pull tokens
  from the `usage` object when the provider returns it.
- Respect rate limits — 500ms sleep between iterations.

A small driver script is usually clearer than raw curl loops. Put it at
`scripts/bench-provider.mjs` if the benchmark will be re-run.

## Step 4: Output

```
Prompt: "<first 40 chars>"
Iterations: N

Provider/Model            | non-stream p50 | non-stream p95 | stream TTFT p50 | tok/s p50 | $/1M tok | cost/run
openai/gpt-4o             |       320 ms   |       410 ms   |       180 ms    |    62     |  $10.00  | $0.00042
groq/llama-3.3-70b        |        95 ms   |       130 ms   |        40 ms    |   280     |   $0.79  | $0.00004
...

Rankings:
  fastest (p50):     groq/llama-3.3-70b
  cheapest:          groq/llama-3.3-70b
  best quality-tier: openai/gpt-4o  (subjective)
```

## Rules

- Use small prompts/outputs so total spend < $0.05 per run. The goal is
  comparison, not load testing.
- Never embed the admin API key in scripts. Read from `.env` or prompt.
- Report exactly what you measured — don't extrapolate tokens/sec from
  prompt-length alone.
- Flag huge variance (p95 > 3× p50) instead of hiding it in an average.
- If one target fails all iterations, omit from the ranking and list the
  failure reason in a footer.
