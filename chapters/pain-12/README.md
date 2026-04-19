---
outline: deep
title: "12. Errors in transpiled/bundled code are unreadable"
---

Stack trace says `bundle.min.js:1:48372`. The original source was `src/components/Checkout.tsx:42`. You can't debug what you can't read.

**Why it matters historically:** motivated **source maps** — a JSON file that maps positions in the output back to the original source. Every transpiler and bundler generates them. Browsers and Node both consume them. Without source maps, the "transpile everything" ecosystem would be unusable in production.

**Chat app step:** someone reports "the chat crashes when I click the retry button on a failed message" and pastes a screenshot: `Uncaught TypeError at bundle.min.js:1:48372`. Useless. Teach our bundler + transpiler to track `{ file, line, col }` positions from each source file through every transform and into the final bundle. Emit a `.map` file alongside; serve it. The browser's devtools now surface the error at `render.js:43` — the actual bug site.

**Tie to JS:** source maps feel like plumbing until you see them light up. Once errors jump to the right file and line, the group understands why *every* transpiler and bundler in the JS world ships them.

---
