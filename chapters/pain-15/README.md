---
outline: deep
title: "15. `node_modules` is a disaster"
---

400MB on disk, 30,000+ files, slow to install, slow to traverse, duplicated across every project on your machine. npm's install algorithm was designed in 2010 and the ecosystem has outgrown it.

**Why it matters historically:** motivated **pnpm** (content-addressable store + symlinks — install once globally, symlink into each project), **yarn PnP** (no `node_modules` at all, zip-based resolution), **bun**'s install (parallelism + native speed). This is also where supply-chain concerns live: lockfiles, `npm audit`, package signing discussions (left-pad, 2016, is the canonical anecdote).

**Chat app step:** we've accumulated marked, a syntax highlighter (Shiki or highlight.js), a test framework, TypeScript, esbuild, wrangler for Workers, plus dev-side tooling. `du -sh node_modules` is alarming. Migrate to pnpm; show the content-addressable store + symlinked `node_modules` structure; compare install time and disk usage against npm on a clean clone.

**Tie to JS:** hands-on "why does pnpm exist?" demonstration. More of a compare-and-discuss moment than a build step — nothing to construct, just to observe.

---
