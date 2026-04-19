---
outline: deep
title: "16. CJS and ESM don't interop cleanly"
---

Node supports both. Import a CJS package from an ESM file → sometimes works, sometimes gives you `{ default: actualExport }`, sometimes errors. Libraries that ship both have a "dual-package hazard": two copies of the same module, two separate identities.

**Why it matters historically:** this is *the* reason `package.json` got complicated. `"type"`, `"main"`, `"module"`, `"exports"`, conditional exports, `.mjs` vs `.cjs` — all of it is Node trying to support both module systems without breaking the world. Arguably the biggest open wound in the JS ecosystem in 2026.

**Chat app step:** we extract the core chat-loop logic — message state machine, model abstraction, retry policy — into a package, `@our-chat/core`. Then we build a second package `@our-chat/plugin-retry` that depends on core and adds retry-on-failure behavior. Ship core as CJS-only → ESM users importing from Vite complain. Ship ESM-only → older build tools break. We configure the `exports` field with conditional entries (`"import"`, `"require"`, `"types"`) and ship both. Hit the dual-package hazard (two instances of core when one caller is CJS and another is ESM) and debug it.

**Tie to JS:** turns the opaque `exports` field into something with a story. Every condition you add answers a specific "what environment is importing me?" question.

---
