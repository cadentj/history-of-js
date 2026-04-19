---
outline: deep
title: "6. JS's dynamic typing hurts at scale"
---

Large codebases: refactors break silently, IDE autocomplete is guessing, `undefined is not a function` at runtime. Tolerable at 1k LoC, miserable at 500k.

**Why it matters historically:** Facebook tried Flow (2014), Microsoft built TypeScript (2012, took off ~2016). TS won by being *gradual* and *deliberately unsound* — pragmatism over correctness. The decision to make TS strip-only (types are erased, not enforced at runtime) shaped how every transpiler since treats types.

**Chat app step:** message shapes have gotten complicated — `{ role, content, tokens, error, retryCount, timestamp, citations, ... }`. A refactor renames `content` to `text` along one code path and the renderer silently breaks — messages stop showing up, no error, just a blank message list. We port the app + tooling to TypeScript. Types are stripped at build; runtime is unchanged. The next refactor fails at edit time instead of at 2am during a demo.

**Tie to JS:** mirrors the TS origin story: types bolted onto a dynamic language *after the fact*, stripped at compile time, gradual adoption. The chat app becomes exactly the sort of codebase TS was designed for — lots of interacting data shapes, async edges, easy places to silently mis-wire.

---
