---
outline: deep
title: "11. JS-in-JS tooling is slow"
---

Babel, webpack, Rollup are all written in JavaScript. Parsing JS in JS, for a large codebase, is inherently slow — you're running an interpreter on an interpreter.

**Why it matters historically:** motivated the native-language rewrites: **esbuild** (Go, ~2020), **SWC** (Rust, ~2019), **Turbopack** (Rust, 2022), **Rolldown** (Rust, 2024). The speedups were 10–100x, enough to reshape what tools people use. Vite uses esbuild in dev and is migrating its prod bundler from Rollup to Rolldown.

**Chat app step:** once we have per-page bundle budgets (pain #8), we iterate constantly — remove this import, add that dynamic chunk, rerun the bundler, recheck sizes. Our zero-dep Node bundler takes 3–5 seconds per rebuild; iteration becomes painful. Swap the bundle step to esbuild and watch it drop to ~100ms. Budget-tuning becomes interactive.

**Tie to JS:** native speed isn't just "faster" — it changes what kinds of work are interactive. At 3s/rebuild you test changes serially; at 100ms you explore combinations. That shift is why esbuild/SWC/Rolldown reshaped the ecosystem.

---
