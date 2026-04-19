---
outline: deep
title: How these map to sessions
---

# How these map to sessions

Probably too many for three 2-hour sessions. A rough grouping:

- **Session 1 — Async, ship the chat app, feel the module pain:** background reading (`background.md`) for the XHR → Promises → async/await arc + event loop; pains 1, 2, 3, 4, 7. Build chat app v1 (single HTML + script tag, async/await fetch through a Node proxy). Split into multiple files and feel the globals collision. Install `marked` (via our toy package manager). Split the proxy across files with CJS. Write the zero-dep Node bundler. End with a multi-file chat app running from one bundled `<script>`.
- **Session 2 — Tooling layer:** pains 5, 6, 8, 9, 10, 11, 12. Transpile step (modern JS → ES5), port to TS, route-level code splitting + tree-shaking + minification against per-page bundle budgets, dev server with HMR, Vite-style dev, swap to esbuild for speed, source maps. Biggest session — probably needs trimming.
- **Session 3 — The modern stack:** pains 13, 14, 15, 16, 17. Build a tiny reactive framework (+ optional V8 puzzle) and refactor the UI on top of it, deploy the proxy to Cloudflare Workers, migrate to pnpm, extract + publish core as a dual CJS/ESM package, retrospective on configs.

Open questions:
- Pain 13 (declarative UI / signals) is huge and probably deserves its own session. Could push to a 4th week or leave frameworks as "further reading."
- Session 2 is overloaded. Candidates to lighten: pain 11 can be a ~20min demo (swap bundler step → time it) rather than a full rebuild; pain 8 can focus on the settings-page budget exercise rather than also doing tree-shaking from scratch.
- Token-level streaming (ReadableStream / async iterators) is held as optional — good "what comes after async/await" beat if session 1 has room.
