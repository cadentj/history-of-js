---
outline: deep
title: "1. Code can't be split across files"
---

Early JS: one `<script>` tag, or several, all sharing one global namespace. Two files both define `handleClick` → one silently overwrites the other. There's no `import`, no `require`, no modules of any kind.

**Why this mattered**: 
Forced the IIFE pattern and "namespace object" pattern as poor-man's modules. Modern module systems grew out of these patterns.
- **IIFE** (Immediately Invoked Function Expression) — `(function(){ ... })()`. A function you define and call in the same expression. Everything declared inside is scoped to the function, not leaked to `window`.
- **Namespace object pattern** — instead of 30 globals (`addMessage`, `renderAll`, `sendToApi`, ...), you make *one* global (`APP`) and hang everything off it: `APP.state.addMessage(...)`, `APP.render.renderAll()`. Poor-man's modules.


**Chat app step:** 
v1 is one `index.html` + one `<script>` tag. 

As we add features — message list rendering, input handling, async “LLM” replies (simulated in the workshop so we focus on JS structure, not auth or network setup), markdown display — the script crosses 300 lines. We split it into `api.js`, `render.js`, `state.js`, each as its own `<script>` tag. 

`render.js` and `state.js` both declare top-level `messages` → whichever loads last wins. We fall back to IIFEs + a manual `window.APP = {}` namespace and feel how fragile it is.

The goal is to help people understand the 2005-era script-tag pain. The discomfort of "I need structure but the language won't give it to me" is exactly what forced the module-system arms race.

**Version 1 — naive: every `var` is a global, files collide**

```html
<!DOCTYPE html>
<html>
<body>
  <div id="messages"></div>
  <input id="input" />
  <button id="send">Send</button>

  <script src="state.js"></script>
  <script src="render.js"></script>
</body>
</html>
```

```js
// state.js — holds the list of chat messages
var messages = [];

function addMessage(role, text) {
  messages.push({ role: role, text: text });
}
```

```js
// render.js — paints the DOM
var messages = document.getElementById('messages'); // same name!

function renderAll() {
  // we wanted to loop over the messages *array*,
  // but `messages` now points at a <div> — state.js's array is gone.
}
```

Both files do `var messages` at the top level. In classic `<script>` land that's the same as `window.messages = ...`. Whichever file loads last wins. Load order becomes load-bearing and silent. This is the pain.

Version 2 uses a `window.APP = {}` pattern. In a browser, top-level `var` and function declarations become properties of `window`. `window.APP = {}` creates one shared global object that every file attaches its public API to.

**Version 2 — IIFE wraps each file, one shared `APP` namespace**

```html
<!DOCTYPE html>
<html>
<body>
  <div id="messages"></div>
  <input id="input" />
  <button id="send">Send</button>

  <script>window.APP = {};</script>   <!-- create the shared namespace once -->
  <script src="state.js"></script>
  <script src="render.js"></script>
</body>
</html>
```

```js
// state.js
(function () {
  var messages = []; // private to this IIFE — invisible to render.js

  function addMessage(role, text) {
    messages.push({ role: role, text: text });
  }

  // publish only what other files need
  window.APP.state = {
    addMessage: addMessage,
    getMessages: function () { return messages; }
  };
})();
```

```js
// render.js
(function () {
  var messagesEl = document.getElementById('messages'); // private, can't collide

  function renderAll() {
    var list = window.APP.state.getMessages();
    messagesEl.innerHTML = list.map(function (m) {
      return '<div>' + m.role + ': ' + m.text + '</div>';
    }).join('');
  }

  window.APP.render = { renderAll: renderAll };
})();
```

Now `state.js`'s `messages` and `render.js`'s `messagesEl` each live inside their own function scope. The *only* thing either file leaks to the global world is its one entry on `window.APP`. You still have to pick unique keys on `APP` (`APP.state`, `APP.render`, `APP.api`), but that's one namespace to police instead of the whole global object. This is exactly why CommonJS and ES Modules feel like such a relief later — they bake "each file is its own scope, exports are explicit" into the language so you stop hand-rolling it.

### Caden Todos here: 
- Build a basic chat app using only the `<script>` tag for Javascript. Can expand on the basic patterns that Opus 4.7 gave me

### Exercises here: 
- Read about the old JS import system, maybe from the "JS: First 20 years" source. 
- Read through Alman's blog post, maybe some linked ECMA standards
- Maybe I give people version 1 of the script with a big state file and ask them to do some light refactoring into the global `APP` pattern. 
  - Plant a footgun where, the logical ordering of imports looks fine but for some reason render has to be written first since it loads ~last for some reason?
  - (Opus 4.7) Why it works mechanically: classic `<script src="...">` tags (no `async`/`defer`) execute synchronously in document order. Every top-level `var x = ...` or `function x() {}` is `window.x = ...`, so if two files both declare `messages`, the one listed **later** in the HTML wins. Deterministic, not racy.
  - (Opus 4.7) Make the failure *runtime*, not load-time. If state.js and render.js both `var messages = ...` and render.js loads last, `window.messages` ends up pointing at a `<div>`. Nothing breaks at load — everything parses and every function gets defined. The app only explodes when someone types a message and `addMessage` runs `messages.push(...)` → `TypeError: messages.push is not a function`. The stack trace points at state.js (the caller), but the *cause* is render.js (the clobberer). That distance between symptom and cause is the whole lesson.
  - (Opus 4.7) The "logical ordering" twist: put the scripts in the order a human would naturally write them — state first, render second ("define the data, then render it"). That's what breaks. The fix-by-reordering workaround (put render *first* so state clobbers it) feels absurd because it reverses the mental model, which is what makes IIFEs feel like the real answer rather than a stylistic preference.
  - (Opus 4.7) Stronger variant: have the footgun involve a function, not just a var. Both files define `function init() { ... }`. Whichever loads last wins. At the bottom of the HTML you call `init()` — it does the wrong thing, and neither file's `init` looks wrong in isolation. Makes the point that *every* top-level identifier is a collision risk, not just variables.
  - (Opus 4.7) Keep the exercise on vanilla `<script src>` tags only. `defer` runs scripts in order but after parsing; `type="module"` gives each script its own scope. Either one makes the footgun non-deterministic or eliminates it entirely, and students get confused about why their fix "worked."

### References: 

Ben Alman, "Immediately-Invoked Function Expression (IIFE)"
- https://benalman.com/news/2010/11/immediately-invoked-function-expression/

Opus 4.7

---
