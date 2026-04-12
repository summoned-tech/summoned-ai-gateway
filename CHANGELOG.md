# Changelog

All notable changes to the Summoned AI Gateway will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-01

### Added

- **Multi-provider gateway** — OpenAI, Anthropic, Google Gemini, Groq, Azure OpenAI, AWS Bedrock, Ollama, Sarvam AI, Yotta Labs
- **OpenAI-compatible API** — Drop-in replacement for `/v1/chat/completions`, `/v1/embeddings`, `/v1/models`
- **Streaming support** — Server-sent events (SSE) for all providers
- **Tool calls** — Function calling support across providers
- **Per-request config** — Retries, fallbacks, caching, guardrails, routing via `x-summoned-config` header
- **Response caching** — Redis-backed cache with configurable TTL
- **Input/output guardrails** — PII detection, regex patterns, blocked words, length limits
- **Virtual keys** — Encrypted provider credential management (AES-256-GCM)
- **API key management** — Multi-tenant keys with per-key rate limits (RPM + TPD)
- **Circuit breaker** — Per-provider circuit breaker with automatic recovery
- **Cost tracking** — USD + INR cost calculation per request
- **Real-time logs** — WebSocket endpoint for live log streaming
- **In-memory log buffer** — Ring buffer with configurable size
- **Audit logging** — Every request logged to PostgreSQL
- **OpenTelemetry tracing** — Distributed tracing with span creation
- **Prometheus metrics** — `/metrics` endpoint for monitoring
- **Health checks** — `/health` and `/health/ready` endpoints
- **Docker support** — Dockerfile + docker-compose.yml for one-command setup
- **TypeScript SDK** — `@summoned/ai` with admin API, streaming, `createHeaders()`
- **Python SDK** — `summoned-ai` with sync/async clients, admin API, streaming, `create_headers()`
