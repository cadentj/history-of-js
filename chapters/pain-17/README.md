---
outline: deep
title: "17. Configuration explosion"
---

A modern project has `package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc`, `postcss.config.js`, `.browserslistrc`, `.npmrc`, sometimes more. Each has its own schema, docs, and gotchas. Onboarding a new developer is mostly explaining config.

**Why it matters historically:** motivated **zero-config tools** (Parcel's original pitch) and **opinionated frameworks** (Next.js, Remix, SvelteKit, Astro) that hide the config behind a single `framework.config.js`. The trade is flexibility for velocity — and most teams are taking it.

**Chat app step:** retrospective. Count every config we've accumulated: `package.json`, `tsconfig.json`, bundler config, dev-server config, `.eslintrc`, `.prettierrc`, `wrangler.toml` for the Worker, `pnpm-workspace.yaml` for the packages split in pain #16. Then: try rebuilding the chat app on SvelteKit or Next. Most configs collapse into one `framework.config.js`. Discuss what's gained (velocity, consistency) and lost (flexibility, transparency).

**Tie to JS:** only lands *after* having felt each config's pain. "Frameworks hide this" is powerful because you paid the cost of every layer they're hiding.

---
