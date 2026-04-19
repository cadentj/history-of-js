---
outline: deep
title: "9. Every save triggers a full rebuild"
---

Early bundler dev loops: edit a file → rebuild the whole bundle → reload the page → lose your app state. Painful for anything non-trivial.

**Why it matters historically:** motivated **watch mode**, then **incremental compilation**, then **Hot Module Replacement** (HMR) — swap a module in a running app without losing state. HMR is one of the killer features of modern dev servers and why Vite/webpack-dev-server feel magical.

**Chat app step:** we're iterating on the message renderer constantly — fixing how code blocks display, tweaking spacing, testing edge cases. Every save → rebuild bundle → reload page → the conversation we were testing evaporates. We start sending the LLM "test" over and over to recreate state. Add a file watcher that rebuilds on save, then an HMR protocol (websocket + module swap) so the renderer reloads without blowing away the conversation in memory.

**Tie to JS:** HMR's value is abstract until you lose your test conversation 40 times in one hour. Then it's obvious.

---
