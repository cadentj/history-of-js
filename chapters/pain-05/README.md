---
outline: deep
title: "5. Browsers don't implement new JS fast enough"
---

ES6 (2015) shipped classes, arrow functions, `let`/`const`, destructuring. Developers wanted to use them *immediately*. IE11 and older browsers didn't support them and wouldn't for years.

**Why it matters historically:** motivated **transpilers**. Babel (2014, originally "6to5") compiled ES6 → ES5 so you could write modern code and ship it everywhere. This established the pattern that the JS you *write* is not the JS that *runs*. Every tool downstream (TypeScript, JSX, Svelte compilation) inherits this pattern.

**Chat app step:** we've been writing `var` everywhere, IIFEs, no arrow functions (async/await is the one thing we kept modern, per `background.md` on async). Tiring. We want the full modern toolkit — `let`/`const`, arrows, classes, template strings, destructuring. We add a **transpile step** to our pipeline: write modern source → our tool rewrites to ES5 → bundler concatenates → ship.

### Plan: toy transpiler (Opus 4.7)

**Infrastructure — use Acorn.** Acorn is the JS parser Babel and Rollup use; zero deps, single npm install, produces ESTree AST. For printing back, either use `astring` (tiny printer) or keep source positions and do string splicing (faster, preserves formatting). V1: print with astring. V2: splice in place.

**Pipeline:** parse → walk the AST → rewrite certain node types → print. That's the whole architecture. Every transpiler in the ecosystem (Babel, SWC, esbuild, tsc) is a variation of this.

**Three transforms, hardest-last:**

**(1) TS type stripping (~50 lines).** Use `acorn-typescript` (or `@babel/parser`). Walk the AST, delete every `TypeAnnotation`, `TSInterfaceDeclaration`, `TSTypeAliasDeclaration`, `TSAsExpression`, `ImportDeclaration` with `importKind: "type"`, etc. Print what's left. This is exactly what [`ts-blank-space`](https://github.com/bloomberg/ts-blank-space) (Bloomberg, 2024) does in ~700 lines — our toy is the 50-line version. This transform alone gets us TS support for pain #6.

**(2) Arrow fn → function expression (~40 lines).** The interesting `this`-binding case.

```js
// input
const add = (x) => x + this.y;

// naive (wrong): `this` inside the function is the new function's this
const add = function (x) { return x + this.y; };

// correct: capture `this` in an enclosing scope, reference the capture
var _this = this;
var add = function (x) { return x + _this.y; };
```

The transform: walk the AST, find `ArrowFunctionExpression`, convert to `FunctionExpression`. If the body references `this`, insert a `var _this = this` at the nearest enclosing non-arrow scope and rewrite every `this` inside the arrow to `_this`. This is what Babel does (with uniquer names). Great `this`-binding lesson falls out of doing the transform.

**(3) async/await → generator + Promise state machine (~80 lines, optional stretch).** The crown jewel — the single most instructive transform in the ecosystem.

```js
// input
async function f() {
  const x = await g();
  return x + 1;
}

// output (roughly)
function f() {
  return runGenerator(function* () {
    const x = yield g();
    return x + 1;
  });
}

function runGenerator(gen) {
  return new Promise(function (resolve, reject) {
    var it = gen();
    function step(value) {
      var result;
      try { result = it.next(value); } catch (e) { reject(e); return; }
      if (result.done) { resolve(result.value); return; }
      Promise.resolve(result.value).then(step, reject);
    }
    step();
  });
}
```

Every `await` becomes a `yield`. The runner pumps the generator: call `next()`, get a promise, wait for it, resume with the resolved value. This is what Babel did for years (2015-2017) before browsers shipped async/await. Transform logic: walk the AST, find `async function`, convert to generator, wrap body in `runGenerator(function* () { ... })`, rewrite every `AwaitExpression` to `YieldExpression`. After writing this, you deeply understand what async/await *is*.

**Recommended path:**
- Do (1) first — practical, short, directly supports pain #6 (TS).
- Do (2) second — teaches transform mechanics + `this`-binding.
- Do (3) as a stretch puzzle — challenging but the most rewarding.

Later: pipe through `esbuild --target=es5` for full coverage of the long tail (destructuring, spread, class fields, etc.) we don't want to hand-write.

**What this reveals:**
- Transpilers are three stages: parse → transform → print. Same as any compiler.
- Why TS is strip-only and deliberately unsound (pain #6): the transform is trivial, and runtime behavior is unchanged — deletion can't introduce bugs.
- Why async/await isn't "just sugar" over Promises — the transform uses generators under the hood, which are themselves non-trivial. Real language-level support buys you efficiency the transpile-down version can't match.
- Why source maps (pain #12) are essential once you have transforms — output positions don't match input positions anymore.

**Exercises:**
- Type-stripping pass. Run it on a TS-flavored version of the chat app; verify the output still executes.
- Arrow transform. Include a `this`-inside-arrow test case; if yours prints `function () { return this.y }` you have the footgun demo for free.
- Puzzle: given a deeply-nested arrow that references `this` and its enclosing function is *also* an arrow, how does your transform walk the scope chain? Write a test case. (Babel handles this correctly; early transforms didn't.)
- Stretch: async/await → generator transform. Verify with an await chain + a try/catch around an awaited rejection.

### References:
- [Acorn](https://github.com/acornjs/acorn) — the parser. Single-file, zero-dep.
- [astring](https://github.com/davidbonnet/astring) — AST printer, ~1k lines.
- [`ts-blank-space`](https://github.com/bloomberg/ts-blank-space) — Bloomberg's ~700-line TS stripper. Good to read after writing yours.
- [AST Explorer](https://astexplorer.net) — paste JS, see the AST. Essential for visualizing what you're walking.
- Babel's [plugin handbook](https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md) — if you want to see how real transforms are structured.
- [Regenerator](https://github.com/facebook/regenerator) — Facebook's async/generator transform. What real async→generator looked like in production.

**Tie to JS:** Babel's exact origin story, told with our tooling. Writing even one transform makes transpilers stop feeling like magic. Writing the async/await one makes *language features themselves* stop feeling like magic.

---
