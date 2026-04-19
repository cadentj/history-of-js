---
outline: deep
title: "2. No way to reuse other people's code reproducibly"
---

Pre-2010: you wanted jQuery, you downloaded `jquery.min.js` and committed it to your repo. No version numbers, no dependency graph, no way to update. Transitive dependencies were manual.

**Why it matters historically:** 
Motivated npm (2010, originally for Node), later Bower (for browser, now dead), and eventually the idea that a JS project has a *manifest* (`package.json`) and a *lockfile*. Half your `package.json` fields trace back to solving this.

**Chat app step:** 
LLM responses come back as markdown (in the workshop the assistant is simulated so we focus on tooling, not API keys or fetch wiring). We want them rendered as real HTML — headings, lists, inline code, code blocks. Writing our own markdown parser is a rabbit hole; we reach for `marked`. Without a package manager we'd download a zip, commit it, pin to whatever version was in the zip, and hope updates don't break us. Instead: `npm init`, `npm install marked`, and a `package.json` + lockfile appear.

`npm install marked` is the moment the manifest-and-lockfile pattern stops feeling like bureaucracy and starts feeling like the only way to say "I depend on marked 9.x" reproducibly.

### Plan (Opus 4.7):

**Feel the pain first (no package manager, just zips):**
Give the group three pre-built libs, zipped, to drop into a `/vendor/` folder and load via `<script>` tags:
- `marked@2.x` — markdown parser
- `sanitize@1.x` — HTML sanitizer that exposes `window.Sanitize`
- `markdown-safe@0.5` — wrapper that calls `marked` then `sanitize`

The trap: `markdown-safe` was written against `marked@1.x` (breaking API change in 2.x). Separately, `marked@2.x` bundles its *own* copy of sanitize at a different version, also assigned to `window.Sanitize`, so whichever script tag loads last clobbers the other. Running the app: markdown kinda renders, code blocks mangle, some links get stripped. No manifest → no way to see the conflict without reading three minified bundles. This is the authentic 2008 pain.

Then we build our package manager and each lib ships with a real manifest declaring its deps and version ranges. Registry serves them. Resolver picks a compatible set. Install lays them out in `node_modules/`. The app `require`s them cleanly.

**Scaffolded (we write upfront so students don't get stuck on plumbing):**
- `registry/` — a local directory of `{name}/{version}/package.json` + source files. No tarballs, no network.
- `manifest.js` — read/write a project's `package.json` dependencies.
- `install.js` — given a resolved tree, write files into `node_modules/`.
- `semver.js` — stub signature `satisfies(version, range)`, empty body.
- `resolve.js` — stub signature `resolve(rootManifest) → tree`, empty body.

Loading is just Node's real `require` — no need to reimplement module resolution here.

**Students fill in:**
- `semver.satisfies` — capped at `MAJOR.MINOR.PATCH` + `^` / `~` / exact. Full spec (prereleases, build metadata) is a swamp and not the lesson.
- Dep graph construction — recursive walk across manifests.
- Resolver — backtracking search over candidate versions.

**Pseudocode: graph building**

```
function buildConstraintGraph(rootManifest):
  constraints = {}   # { packageName: [ (requiredBy, range), ... ] }
  queue = [rootManifest]
  seen = set()
  while queue not empty:
    manifest = queue.pop()
    for (depName, range) in manifest.dependencies:
      constraints[depName].append((manifest.name, range))
      for version in registry.versionsOf(depName):
        if satisfies(version, range) and (depName, version) not in seen:
          seen.add((depName, version))
          queue.push(registry.manifestFor(depName, version))
  return constraints
```

**Pseudocode: backtracking resolver**

```
function resolve(rootManifest):
  constraints = buildConstraintGraph(rootManifest)
  return backtrack({}, list(constraints.keys()), constraints)

function backtrack(chosen, remaining, constraints):
  if remaining is empty:
    return chosen
  name = remaining[0]
  candidates = registry.versionsOf(name)
               .filter(v => all(satisfies(v, r) for (_, r) in constraints[name]))
               .sortedDescending()
  for candidate in candidates:
    newConstraints = mergeDepsOf(constraints, name, candidate)
    if consistent(newConstraints):   # no range intersects to empty
      result = backtrack(chosen | {name: candidate}, remaining[1:], newConstraints)
      if result: return result
  return None   # conflict, signal backtrack to caller
```

Most of the time highest-matching succeeds on the first try; backtracking only kicks in when a later package narrows an earlier one. That's the pedagogical moment: "see how picking marked@2.x forced us to back up and pick markdown-safe@0.3 instead of @0.5?"

**Designing the fake package set — three flavors to cover:**
1. *Happy path:* `app → marked@^1`. Trivial, warms up the pipeline.
2. *Diamond:* two deps both want `core@^1` → dedupe to one copy.
3. *Conflict requiring backtrack:* `app → a@^1, b@^1`; `a@1.5 → core@^2`, `b@1.2 → core@^1`. Resolver picks `a@1.5` first, hits conflict on `core`, backtracks to `a@1.4` which wants `core@^1`, succeeds.

### Integrating with the chat app (Opus 4.7):

Our package manager writes `node_modules/`, but the browser can't `require` from there — that's pain #4. For now we lean on the convention of the era: each browser lib in our registry ships a `dist/<name>.js` that's an IIFE attaching to a global (marked → `window.marked`, sanitize → `window.Sanitize`). That's what UMD was designed for; our toy versions can be IIFE-only.

After `our-npm install marked sanitize`:

```
node_modules/
  marked/dist/marked.js       ← IIFE, assigns window.marked
  sanitize/dist/sanitize.js   ← IIFE, assigns window.Sanitize
```

`index.html` hand-includes them in topological order, before our code:

```html
<!-- deps first, in topological order -->
<script src="node_modules/sanitize/dist/sanitize.js"></script>
<script src="node_modules/marked/dist/marked.js"></script>

<!-- our namespace + our code -->
<script>window.APP = {};</script>
<script src="state.js"></script>
<script src="render.js"></script>
```

The IIFEs from section 2 just read the new globals:

```js
// render.js
(function () {
  var messagesEl = document.getElementById('messages');

  function renderAll() {
    var list = window.APP.state.getMessages();
    messagesEl.innerHTML = list.map(function (m) {
      var html = window.marked.parse(m.text);       // lib 1
      var safe = window.Sanitize.clean(html);       // lib 2
      return '<div>' + m.role + ': ' + safe + '</div>';
    }).join('');
  }

  window.APP.render = { renderAll: renderAll };
})();
```

**The unsatisfying parts — and that's the point:**
- We hand-write `<script>` load order for every transitive dep. (Stretch: have our package manager emit a `scripts.txt` in topological order — poor-man's bundler output, which is what Grunt/Gulp concat plugins did in 2012.)
- Every lib adds another global to `window`; collisions are still possible.
- The browser makes N requests — one per dep — paying a round-trip each (pain #7).
- We still can't `require('./sibling')` between our *own* files; internally we're stuck with the namespace pattern.

Server side is a different story: the Node proxy `require`s straight from `node_modules/` via Node's built-in resolution, no bundler needed. That contrast — *server-side modules are easy, client-side isn't* — is the setup for pains #3 and #4.

**LSP note:** tsserver handles the syntax (old-style JS is still JS), but cross-file `window.APP.state.addMessage` won't autocomplete without a small `globals.d.ts` declaring `interface Window { APP: { state: ...; render: ... } }`, or JSDoc annotations on each IIFE's published object. Third-party libs are similar — `@types/marked` declares both the module export and the global, so `window.marked` autocompletes once types are installed. The module-less world doesn't give editors enough structure to help much; another authentic pain, and a natural setup for why pain #6 (TypeScript) pairs with pain #3 (modules).

### References:
- **PubGrub** — Natalie Weizenbaum, "PubGrub: Next-Generation Version Solving". The algorithm behind Dart's pub, Python's uv, and Poetry. Better error messages than naive backtracking because it records which constraints conflicted. 
  - https://nex3.medium.com/pubgrub-2fb6470504f
- **Cargo** — Rust's package manager, readable resolver source in `src/cargo/core/resolver/`.
- **uv** (Astral, Rust) — Python package manager, uses PubGrub. Extensive design docs in-repo.
  - "How UV got so fast" 
    - https://news.ycombinator.com/item?id=46393992
    - https://nesbitt.io/2025/12/26/how-uv-got-so-fast.html
- **npm** — greedy heuristics, not a real solver. Hence duplicate installs and hoisting quirks. Good contrast to the solver-based world.

### Caden Todos here: 
- work w claude to impl the plan here

### Exercises: 
- Skim PubGrub. Maybe check how approachable it is first, though.
- Implement dependency graph building, backtracking solving

---
