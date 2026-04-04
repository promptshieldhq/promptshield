# PromptShield

Open source LLM gateway with PII and secret detection built in. Runs on your infrastructure.

This is the main monorepo. The proxy and detection engine live in separate repos:

- **Proxy**: [promptshieldhq/promptshield-proxy](https://github.com/promptshieldhq/promptshield-proxy)
- **Engine**: [promptshieldhq/promptshield-engine](https://github.com/promptshieldhq/promptshield-engine)

## Running locally

```bash
bun install
```

Run everything:

```bash
bun run dev
```

Or run individual apps:

```bash
bun run dev:docs    # Documentation 
bun run dev:web     # Dashboard UI
bun run dev:server  # API server
```

## Contributing

See [CONTRIBUTING](/apps/docs/content/docs/contributing.mdx).

## License

MIT
