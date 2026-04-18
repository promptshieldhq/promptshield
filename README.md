# PromptShield

<p align="center">
  <a href="https://github.com/promptshieldhq/promptshield/stargazers"><img src="https://img.shields.io/github/stars/promptshieldhq/promptshield?style=flat&color=22c55e" alt="Stars" /></a>
  <a href="https://github.com/promptshieldhq/promptshield/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License" /></a>
  <a href="https://discord.gg/gJbYyhJU"><img src="https://img.shields.io/discord/1494515139230044261?label=Discord&logo=discord&color=5865F2" alt="Discord" /></a>
  <a href="https://promptshield-docs.vercel.app/docs/quickstart"><img src="https://img.shields.io/badge/docs-quickstart-orange" alt="Docs" /></a>
</p>

<p align="center">
  <a href="https://promptshield-docs.vercel.app/docs/quickstart">Quickstart</a> ·
  <a href="https://promptshield-docs.vercel.app">Docs</a> ·
  <a href="https://discord.gg/gJbYyhJU">Discord</a> ·
  <a href="https://github.com/orgs/promptshieldhq/discussions">Discussions</a>
</p>

https://github.com/user-attachments/assets/1199aa4a-1e13-4bfc-97f6-09b6fdfc4784

---

PromptShield is an open source LLM security platform. It routes every request through a security gateway that scans for PII and leaked secrets, enforces a YAML policy, and gives you a dashboard to manage policy, review audit logs, and track what's being blocked with no changes to your application code.

Three components:

- **Gateway** : LLM security gateway policy enforcement, multi-provider routing, rate limiting, token budgets, audit logging
- **Detection Engine** : scans prompts for PII
- **Dashboard** : policy editor, audit log, key management, metrics


> **Note:** Only the gateway is required. The detection engine and dashboard are optional. The gateway runs standalone with **secret detection (150+ rules via Gitleaks, built-in)**, rate limiting, token budgets, and audit logging. The engine adds PII detection (names, phone numbers, SSNs) and prompt injection detection.


<img src="./apps/docs/public/images/dashboard/dashboard.png" alt="PromptShield dashboard" />


---

## Quickstart

Each component lives in its own repo. Clone all three, then bring them up in order , the main repo creates the shared Docker network that the gateway and engine join.

**Step 1 : Clone all three repos:**

```bash
git clone https://github.com/promptshieldhq/promptshield
git clone https://github.com/promptshieldhq/promptshield-gateway
git clone https://github.com/promptshieldhq/promptshield-engine
```

**Step 2: Start the dashboard stack** (creates the `promptshield` network and shared policy volume):

```bash
cd promptshield
cp .env.local.example .env.local
# fill in BETTER_AUTH_SECRET and your provider API key

docker compose -f docker-compose.dev.yml up --build
```

**Step 3 : Start the detection engine** (in a new terminal):

```bash
cd promptshield-engine
cp .env.local.example .env.local

docker compose -f docker-compose.dev.yml up --build
```

**Step 4 : Start the gateway** (in a new terminal):

```bash
cd promptshield-gateway
cp .env.example .env
# set PROMPTSHIELD_PROVIDER and your LLM provider API key

docker compose -f docker-compose.dev.yml up --build
```

| Service | URL |
|---|---|
| Dashboard | http://localhost:8000 |
| API server | http://localhost:3000 |
| Gateway | http://localhost:8080 |
| Engine | http://localhost:4321 |
| Docs | http://localhost:4000 |

Point your app at `http://localhost:8080/v1`, same OpenAI-compatible API, no other changes.

```bash
# verify the gateway is up
curl http://localhost:8080/health

# send a prompt with PII — blocked or masked depending on your policy
curl -s -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "My SSN is 123-45-6789"}]
  }'
```

**Without Docker:**

```bash
# 1. Detection engine
cd promptshield-engine
uv sync && uv run python -m spacy download en_core_web_sm
uv run python main.py   # → :4321

# 2. Gateway
cd promptshield-gateway
cp .env.example .env
make run   # → :8080

# 3. Dashboard
cd promptshield
bun install
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
cd packages/db && bunx drizzle-kit migrate && cd ../..
bun run dev:server   # → :3000
bun run dev:web      # → :8000
bun run dev:docs     # → :4000
```

---

## What gets detected

**Secrets built into the gateway (no engine needed)**

- Powered by [Gitleaks](https://github.com/gitleaks/gitleaks) running in-process in Go. 150+ rules, ~1-3ms per request.

**PII which requires the detection engine**

- Powered by [Presidio](https://microsoft.github.io/presidio/) + custom recognizers. Six languages (en / zh / fr / de / ko / ja) with automatic detection.

- Per-entity confidence thresholds configurable in `presidio_filters.json`.

---

## Features

**Policy**

Single YAML file. Every PII entity type gets its own action: `allow`, `mask`, or `block`. Global confidence threshold (`pii_min_score`). Hot-reloads without restarting the gateway. Editable from the dashboard or as a plain file.

```yaml
pii_min_score: 0.70

pii:
  US_SSN: block
  CREDIT_CARD: block
  EMAIL_ADDRESS: mask
  AWS_SECRET_KEY: block
  RSA_PRIVATE_KEY: block

injection:
  action: block

on_detector_error: fail_closed  # or fail_open
```

**Rate limiting**

Token bucket, per-IP or per-API-key. Configurable requests-per-minute and burst. Caps at 100k tracked clients with background LRU eviction.

```yaml
rate_limit:
  requests_per_minute: 60
  burst: 10
  key_by: api_key  # or ip
```

**Token budgets**

Cumulative token usage tracked per client over rolling daily, weekly, and monthly windows. Requests blocked once a window is exhausted.

```yaml
token_budget:
  daily:
    tokens: 100000
    key_by: api_key
  monthly:
    tokens: 2000000
    key_by: api_key
```

**Token limits**

Hard cap on output tokens and max prompt length per request.

```yaml
token_limits:
  max_tokens: 4096
  max_prompt_length: 8000
```

**Audit log**

Every request emits a structured NDJSON event to stdout. 

Set `PROMPTSHIELD_AUDIT_URL` to push events directly to the dashboard without a log-forwarder.

**Prometheus metrics**

| Metric | Labels |
|---|---|
| `promptshield_requests_total` | action, provider, model |
| `promptshield_request_duration_seconds` | action, provider, model |
| `promptshield_tokens_total` | type (prompt/completion/total), provider, model |
| `promptshield_entities_detected_total` | entity_type, provider |
| `promptshield_injections_detected_total` | provider, model |
| `promptshield_response_scans_total` | provider, model |

**Response scanning**

Optional PII scan on LLM output before it's returned to the caller.

```yaml
response_scan:
  enabled: true
```

**Multi-provider routing**

Routes to OpenAI, Anthropic, Gemini, self-hosted, or any OpenAI-compatible endpoint. In multi-provider mode, routing is automatic by model name prefix — no config needed:

- `gpt-*`, `o1`, `o3`, `o4`, `chatgpt-*` → OpenAI
- `claude-*` → Anthropic
- `gemini-*` → Gemini

Custom routes override the defaults via `PROMPTSHIELD_MODEL_ROUTES`.

**API key vault**

Configure key pools per provider (comma-separated). The gateway round-robins across them — clients never see the real keys.

```
OPENAI_API_KEY=key1,key2,key3
ANTHROPIC_API_KEY=key1,key2
```

Key resolution order per request: request header → key pool → bearer passthrough.

**Streaming**

Full SSE streaming support. Token usage is extracted from stream chunks and tracked against budgets. Response scanning is skipped on streams.

**Policy hot-reload**

The gateway watches the policy file for changes and reloads atomically, no restart, no dropped requests. If the reload fails, the previous policy stays in place.

**Self-hosted**

Prompts never leave your infrastructure. No external API calls for detection.

---

## Repos

| Repo | What it is |
|---|---|
| [promptshieldhq/promptshield](https://github.com/promptshieldhq/promptshield) | Dashboard, API server, docs |
| [promptshieldhq/promptshield-gateway](https://github.com/promptshieldhq/promptshield-gateway) | Gateway, policy enforcement, audit |
| [promptshieldhq/promptshield-engine](https://github.com/promptshieldhq/promptshield-engine) | PII

---

## Community

<p align="left">
  <a href="https://discord.gg/gJbYyhJU">
    <img src="https://discord.com/api/guilds/1494515139230044261/widget.png?style=banner2" alt="PromptShield Discord" />
  </a>
</p>

- [Discord](https://discord.gg/gJbYyhJU) : questions and live chat
- [GitHub Discussions](https://github.com/orgs/promptshieldhq/discussions) : ideas, RFCs, design decisions

---

## Contributing

See [CONTRIBUTING](./apps/docs/content/docs/contributing.mdx). Issues tagged [`good first issue`](https://github.com/promptshieldhq/promptshield/labels/good%20first%20issue) are a good starting point.

## Security

Report vulnerabilities via [GitHub Security Advisory](https://github.com/promptshieldhq/promptshield/security/advisories/new), not in public issues. See [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE)
