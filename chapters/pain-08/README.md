---
outline: deep
title: "8. Bundle sizes are huge"
---

Naive bundling means visiting `/login` downloads your entire app including the admin dashboard and the checkout flow. Users on slow networks suffer.

**Why it matters historically:** motivated **tree-shaking** (drop unused exports — relies on ESM's static structure, which is a big reason ESM was designed to be static), **code-splitting** (lazy chunks loaded on demand), and **dynamic import** (`import()`). This is why Rollup pushed ESM-first: CJS can't be tree-shaken reliably because `require` is dynamic.

**Chat app step:** we add a Settings page (model picker, theme, API-key management, usage history). Our naive bundler produces one monolithic bundle that includes the settings form libs, a color picker, and the admin tools on *every* page — including the main chat route. Set budgets: chat page < 150KB, settings page < 50KB. We miss. Add (a) route-level code splitting — settings becomes a lazy chunk loaded on navigation — (b) tree-shaking, which requires switching import parsing to ESM's static `import`/`export` form so we can tell what's unused, and (c) a minification pass (identifier mangling + whitespace stripping) — and notice the failure modes of minification: code that reads `Function.prototype.name`, accesses properties by stringly-built keys, or relies on implicit globals all break quietly. Hit the budget.

**Tie to JS:** exactly why Rollup/ESM pushed static imports — you can't tree-shake our CJS bundler output because `require` is dynamic; you need ESM's static structure. A language-design decision with concrete downstream consequences. Minification adds a second teaching moment: "your code is valid JS, the output is valid JS, but they behave differently" → motivates source maps (pain #12).

**Exercise idea (Triton-puzzle style):** "The settings page is 180KB. Get it under 50KB without removing features." Group races, measures with their own bundler output, iterates.

---
