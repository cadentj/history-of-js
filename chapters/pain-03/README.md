---
outline: deep
title: "3. Server-side JS needs real modules"
---

Node (2009) wanted to write non-trivial server programs. Globals-and-script-tags doesn't fly when you have a 50-file backend. Node adopted **CommonJS**: `const x = require('./foo')`, synchronous, runtime-resolved, filesystem-based.

**Why it matters historically:** CJS became the lingua franca of server JS for a decade. Every npm package shipped CJS. The entire ecosystem's "default" was CJS until ESM started winning around 2020 — and we're still cleaning up the mess.

**Chat app step:** the proxy was one `server.js`. It grows — routes for chat completion, model list, usage stats; middleware for rate limiting and logging. We split it across `server.js`, `routes/chat.js`, `routes/models.js`, `middleware/ratelimit.js`, each with `require('./routes/chat')` etc. But rather than just using Node's built-in `require`, we **build our own** first — then use ours to load the split proxy.

### Plan: toy CJS loader (Opus 4.7)

CJS's runtime mechanism is genuinely ~30 lines. The full loader with resolution is ~100. We build both, in two phases.

**Phase 1 — the mechanism (~30 lines).** Given an absolute path, load and run a module:

```
function require(absPath):
  if cache[absPath]: return cache[absPath].exports
  source = readFileSync(absPath)
  module = { exports: {} }
  cache[absPath] = module                 # cache BEFORE running — supports circular deps
  wrapped = `(function (module, exports, require, __filename, __dirname) {
    ${source}
  })`
  fn = eval(wrapped)                      # or new Function(...) — avoids outer-scope leak
  fn(module, module.exports, scopedRequire(absPath), absPath, dirname(absPath))
  return module.exports
```

`scopedRequire(callerPath)` returns a function that resolves relative specifiers against `callerPath`'s directory — so `require('./foo')` inside `routes/chat.js` means `routes/foo.js`.

**Phase 2 — resolution (~60 lines).** Given a specifier string and the caller's directory, find the absolute file path:

```
function resolve(spec, callerDir):
  if spec starts with "./" or "../":
    base = join(callerDir, spec)
    try: base, base + ".js", base + "/index.js", base + "/package.json".main
  else:
    # bare specifier: walk up looking in node_modules
    dir = callerDir
    while dir != "/":
      candidate = join(dir, "node_modules", spec)
      try: candidate, candidate + ".js", candidate + "/index.js", candidate/package.json".main
      dir = parent(dir)
  throw "Cannot find module " + spec
```

**What this reveals:**
- Why `require.cache` exists and why circular deps return *partially-initialized* exports — you hand back `module.exports` at the moment of re-entry, before the callee finishes. Classic CJS gotcha.
- Why `module.exports = x` and `exports = x` differ. `exports` is just a local parameter pointing at `module.exports`; rebinding the parameter doesn't change the module object.
- Why every Node file has `__filename`, `__dirname`, `module`, `exports`, `require` without importing anything: they're the wrapper function's parameters.
- Why Node's module system is synchronous and filesystem-bound — which is exactly the thing that breaks in the browser and forces bundlers (pain #4).

**Exercises:**
- Implement phase 1 against hand-rolled absolute paths. Get the chat proxy split and loading with your own `require`.
- Implement phase 2. Now `require('marked')` from the proxy walks up to `node_modules/marked/package.json` and loads its `main`.
- Puzzle: write two files that `require` each other and print intermediate `module.exports`. Predict and verify what each side sees.
- Stretch: support `.json` (parse instead of eval) and a third-party `.node` addon noop.

### References:
- Node.js docs, "Modules: CommonJS modules" — the spec in plain English.
- [`require` source in Node](https://github.com/nodejs/node/blob/main/lib/internal/modules/cjs/loader.js) — 2000+ lines, but the core mechanism is recognizable.
- Ryan Dahl, "10 things I regret about Node" (2018) — item #7 is about module resolution. Good "here's why this design is regretted now" counterpoint.

**Tie to JS:** the Node / CJS origin story verbatim, with enough internals that CJS stops being a black box. Because we're building a server and a client at the same time, the contrast with pain #4 is vivid: the exact loader we just wrote *cannot* run in the browser — `readFileSync` doesn't exist, and even async `fetch` can't be used synchronously inside `require(...)` evaluation. That impossibility is what bundlers fix.

### Caden Todos here: 

---
