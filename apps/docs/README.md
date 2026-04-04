# PromptShield Docs

Documentation site for [PromptShield](https://github.com/promptshieldhq/promptshield-proxy) — open-source LLM proxy with PII detection, injection blocking, rate limiting, audit logging, and Prometheus metrics.

Built with [Fumadocs](https://fumadocs.vercel.app) on TanStack Start.

## Structure

```
apps/docs/
├── content/docs/       # MDX content files
│   └── meta.json       # Navigation order and section labels
├── src/
│   ├── components/
│   │   └── mdx.tsx     # Registered MDX components
│   ├── lib/
│   │   ├── source.ts   # Fumadocs source loader
│   │   └── shared.ts   # App name, GitHub config, route constants
│   └── routes/
│       └── docs/$.tsx  # Docs page renderer
└── public/
    └── images/         # Static assets (architecture diagram, etc.)
```

## Commands

```bash
bun run dev          # start dev server
bun run build        # production build
bun run types:check  # fumadocs-mdx codegen + tsc --noEmit
```

## Adding a page

1. Create `content/docs/<slug>.mdx` with `title` and `description` frontmatter.
2. Add the slug to the `pages` array in `content/docs/meta.json`.

Section separators in `meta.json` use the `---Label---` syntax.

## Available MDX components

`<Callout>`, `<Cards>`, `<Card>`, `<Tabs>`, `<Tab>`, `<Files>`, `<File>`, `<Folder>`, `<Accordion>`, `<Accordions>`, `<Step>`, `<Steps>`, `<Banner>`, `<TypeTable>`, `<InlineTOC>`

See `src/components/mdx.tsx` for the full registration.
