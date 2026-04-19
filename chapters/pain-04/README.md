---
outline: deep
title: "4. Browser can't do synchronous `require`"
---

CJS assumes you can block on a local filesystem read. Browsers can't — fetching a module over the network is async. You can't evaluate `require('./foo')` inline because `foo` hasn't arrived yet.

**Why it matters historically:** motivated AMD (`define([...deps], factory)`) as an async alternative, UMD as the "works in both" wrapper, and — critically — **bundlers** as a workaround: pre-compile the whole dep graph into a single file so the browser never has to do runtime resolution. Browserify (2011) and webpack (2012) were born here.

**Chat app step:** we love how the proxy splits across files. We want the same on the client — `require('./render')`, `require('./api')`. The browser can't do `require`. We write a ~150-line zero-dep Node bundler and ship the chat app as one bundled `<script>`. (Assistant replies are simulated in the workshop so the lesson stays about bundling, not live LLM calls.)

### Plan: toy bundler, Browserify-shaped (Opus 4.7)

The key insight: do pain #3's resolution work *at build time*, not at runtime. The runtime in the browser is then tiny — basically pain #3's loader minus the filesystem.

Historical framing: this is **Browserify circa 2011** — the first bundler. Webpack (2012) added loaders (CSS, images), a plugin system, and sophisticated code-splitting, and became dominant by ~2016 with React/CRA. Our toy grows webpack-shaped as we extend it in pain #9 (HMR) and pain #8 (code splitting).

**Pipeline (~150 lines, vanilla Node):**

```
function bundle(entryPath):
  modules = {}          # { id: { absPath, code, deps: { spec: id } } }
  byPath = {}           # { absPath: id } — dedupe
  nextId = 0
  queue = [entryPath]
  while queue not empty:
    abs = queue.pop()
    if abs in byPath: continue
    id = nextId++
    byPath[abs] = id
    source = readFileSync(abs)
    deps = {}
    for spec in findRequireCalls(source):       # regex for v1, AST for v2
      depAbs = resolve(spec, dirname(abs))      # reuse pain #3's resolver
      queue.push(depAbs)
      deps[spec] = byPath[depAbs] ?? "pending"  # fix up after queue drains
    modules[id] = { absPath: abs, code: source, deps }
  fixUpPendingIds(modules, byPath)
  return emit(modules, byPath[entryPath])

function emit(modules, entryId):
  # rewrite each module: require("./foo") → require(3)
  for each module in modules:
    module.code = replaceRequireSpecsWithIds(module.code, module.deps)
  return `${runtime}
    const modules = ${serializeModuleTable(modules)};
    require(${entryId});`
```

**The runtime (~15 lines, ships in the bundle):**

```js
(function () {
  var cache = {};
  function require(id) {
    if (cache[id]) return cache[id].exports;
    var module = { exports: {} };
    cache[id] = module;
    modules[id](module, module.exports, require);
    return module.exports;
  }
})();
```

Compare to pain #3's loader: identical shape, except `modules[id]` is a table baked into the bundle instead of a file read off disk. Bundling is just CJS-at-build-time.

**What this reveals:**
- Every bundler output has "module IDs" — they're the artifact of baking resolution into the bundle.
- Why bundling survived ESM shipping natively (pain #7): still one request vs. N.
- Why tree-shaking is hard with CJS (pain #8): `require(x)` where `x` is dynamic can't be statically known. ESM's static `import` structure is the fix.
- Why the bundle's runtime is tiny compared to the build logic — the hard work is the graph walk, the runtime is just a lookup table.

**Exercises:**
- Implement the regex-based version. Bundle a three-file chat client, ship as one `<script>`.
- Hit the regex's limits: a `require` inside a string literal or comment gets matched. Swap to Acorn-based detection of actual `CallExpression` nodes named `require`.
- Puzzle: two modules that `require` each other (circular dep). What does the browser runtime return? Verify it matches the Node-CJS behavior from pain #3.
- Stretch: add a sourcemap emit (just enough to map bundle lines back to source file + line). Pain #12 generalizes this.

### References:
- [Browserify source](https://github.com/browserify/browserify) — the original, ~1k lines for the core.
- James Halliday's [browserify handbook](https://github.com/browserify/browserify-handbook) (2014) — the design philosophy.
- [minipack](https://github.com/ronami/minipack) — an existing ~200-line educational bundler. Good to read after writing your own.
- Webpack's [concepts docs](https://webpack.js.org/concepts/) — see what our toy is *missing* (loaders, plugins, chunks).

**Tie to JS:** Browserify in miniature. Building it ourselves makes bundlers feel like a *natural* solution rather than a mysterious config layer — they exist because the browser can't do what Node can. And once you've written one, webpack stops being magic: it's the same core graph walk + module table, with a loader pipeline bolted on top.

---
