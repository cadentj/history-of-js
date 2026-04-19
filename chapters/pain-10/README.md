---
outline: deep
title: "10. Cold-start dev servers are slow"
---

Webpack-era dev: start the server, wait 30 seconds while it bundles everything, *then* you can open localhost. For large apps, dev startup became minutes.

**Why it matters historically:** motivated Vite's architectural bet — **don't bundle in dev at all**. Serve native ESM to the browser, let it request modules on demand, only transform what's needed. Dev server starts instantly regardless of app size. This is *the* defining idea of modern JS tooling in the 2020s.

**Chat app step:** the chat app + its deps have grown. Our bundler's cold start now takes several seconds before we can open localhost. Switch dev to a Vite-style model: a tiny Node HTTP server serves each module as a native-ESM response on demand, transforms only on request, no eager bundling. Cold start is near-instant regardless of project size.

**Tie to JS:** Vite's insight: don't do the work until the browser asks for it. Obvious in hindsight, non-obvious for a decade.

---
