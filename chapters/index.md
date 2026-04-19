---
layout: home
hero:
  name: JS Ecosystem Plan
  text: Progressive toy chat app curriculum
  tagline: Pain points ordered roughly chronologically
---

The web has a long history, and there are a lot of design decisions that went into the modern javascript ecosystem. There are also a lot of tools and conventions (many of them overlapping), and it would be great to orient myself on them.

Rather than learning things by just reading "esbuild is X", I'd like to build a toy project, progressively going up the tech stack to understand why tools and language changes occured.

## What we're building

We'll build a toy chat app. A user types messages, an LLM responds. We start as a single HTML file with a `<script>` tag calling a free OpenRouter endpoint and grow into a multi-page web app with markdown-rendered replies, conversation history, and a settings panel — deployed to the edge.

**Feature progression (rough shape, not a rigid plan):**
- v1: one page, one input, messages stacked, request-response (send → wait → display)
- v2: markdown rendering with code blocks, retry on failure, conversation history persisted to localStorage
- v3: conversation list sidebar, settings page, shareable URLs, deployed to Cloudflare

### Architecture

- **Client** — the browser app. Most of our work lives here.
- **Proxy** — a tiny Node server that holds the OpenRouter API key and forwards requests from the browser. Never put the API key in client JS — it leaks to anyone viewing page source. The proxy grows into a real backend (rate limiting, model list, usage tracking) as sessions progress.

### Source conventions

We start writing **plain, old-style JavaScript** — no `let`/`const`, no arrow functions, no modules. ES3/ES5-ish. The one deliberate exception is async code: `background.md` covers the XHR → Promises → async/await arc as background reading, and from that point on we use async/await everywhere — it's too painful to read deeply-nested callbacks for the whole project. Other modern syntax (let/const, arrows, classes, destructuring) gets introduced later via a transpile step (pain #5).

### Tooling language

All the tools we build (bundler, type-stripper, dev server, source-map generator) are written in **zero-dependency Node**. We deliberately don't shell out to `esbuild` or `webpack` initially — we implement them ourselves in vanilla Node, the same language the real ecosystem is mostly built in. Pain #11 is where we swap our hand-rolled tool for a native one and feel the speedup.

### Stretch / optional

- **Token-level streaming** (ReadableStream / async iterators) as an optional enhancement for LLM responses. Pairs naturally with `background.md` (async) as the "what comes after async/await" beat. Skip unless time allows.
- **Triton-puzzle-style exercises** — concrete before/after perf targets the group races to hit (e.g., "get the settings page under 50KB"). Fit naturally at pains 8, 10, 12, 13.

### Exercise Thoughts: 
- Is there a way we could get people to arrive on the right decision decision on their own? Maybe with some extra help, like reading some primary or secondary sources on the topic?
- I like the puzzle style questions from Sasha Rush's Triton Puzzles. I wonder if there's an analogy to any of the issues here.

---

Pain points below are ordered roughly chronologically.

---

