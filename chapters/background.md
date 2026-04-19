---
outline: deep
title: "1. No first-class async"
---

When JS launched in 1995, pages could do math and move things around — but talking to a server meant a full page reload. Microsoft fixed this in 1999 by shipping `XMLHttpRequest` in IE5 (as an `ActiveXObject`, of all things). Gmail made the pattern famous in 2004; "AJAX" was coined the year after. But the language itself had no native async primitive for another decade: Promises landed in ES2015, async/await in ES2017. That's a **22-year arc** from "there is no async" to "async is readable."

**Why it matters historically:**
Every browser API that waits on something — network, disk, timers, user input, streaming — is async. The callback → Promise → async/await progression is the single most important readability shift in JS's history. It also forced the language to formalize the **event loop** and **microtask queue**, which are the mental model every JS dev needs and the source of most "why didn't my UI update when I expected" bugs.

**Chat app step:**
We need to send a message and display the reply (in the workshop the backend is simulated so we can focus on async patterns, not running a real chat server). We write the request three ways, chronologically, to feel the arc — then use the modern form for the rest of the project.

1. **XHR with callbacks (1999).** Nested `onload`/`onerror` handlers, no error propagation.
2. **Promises (2015).** Chainable `.then`, errors bubble through `.catch`. Still callback-shaped.
3. **async/await (2017).** Flat, linear, `try/catch` works normally.

```js
// 1. XHR — nesting compounds; two requests means two layers
var xhr = new XMLHttpRequest();
xhr.open('POST', '/chat');
xhr.onload = function () {
  if (xhr.status !== 200) { showError(xhr.statusText); return; }
  var reply = JSON.parse(xhr.responseText);
  render(reply);
};
xhr.onerror = function () { showError('request failed'); };
xhr.send(JSON.stringify({ text: input }));
```

```js
// 2. Promises — flat chain, single .catch
fetch('/chat', { method: 'POST', body: JSON.stringify({ text: input }) })
  .then(function (res) { return res.json(); })
  .then(render)
  .catch(showError);
```

```js
// 3. async/await — looks synchronous, errors via try/catch
async function send(input) {
  try {
    const res = await fetch('/chat', { method: 'POST', body: JSON.stringify({ text: input }) });
    render(await res.json());
  } catch (e) { showError(e); }
}
```

After this section, **we use async/await for all network/async code for the rest of the project**, even while other old-school patterns (`var`, IIFEs, script tags) stick around until pain #6. History is the pedagogy; modern syntax is the daily practice.

### The event loop and microtask queue

JS is single-threaded — one call stack, one thing running at a time. When code `await`s or registers a callback, the function returns; the runtime picks up waiting work when the queue next drains.

Two queues, same event loop:
- **Task queue.** `setTimeout`, I/O callbacks, DOM events. Each task runs to completion before the loop moves on.
- **Microtask queue.** `Promise.then`, `queueMicrotask`, `MutationObserver`. Drained **fully** after every task, before the next task starts.

```js
setTimeout(function () { console.log('timeout'); }, 0);
Promise.resolve().then(function () { console.log('promise'); });
console.log('sync');
// Output order: sync, promise, timeout
```

Microtasks were formalized with Promises (2015) to guarantee `.then` runs before the browser repaints or handles another event. Historically the distinction barely mattered because nothing scheduled microtasks; now it's load-bearing. Common gotcha: a chain of `await`s can starve a paint you were expecting between them — every `.then` is a microtask, and microtasks drain to empty before the browser gets control back.

### Exercises here:
- Read the three implementations side by side. Rewrite each form into the next (XHR → Promise, Promise → async/await) until the translation feels mechanical.
- Flatten a nested callback chain ("send a message → fetch suggestions based on the reply → render both") into async/await. Five levels of indentation collapse to five lines.
- Puzzle: predict the log order for a tangle of `setTimeout(fn, 0)`, `queueMicrotask(fn)`, `Promise.resolve().then(fn)`, and synchronous `console.log`. Run and verify.
- (Optional) A debounced input that fires a request on every keystroke has a race: an older request resolves after a newer one, and stale suggestions render. Fix with an "is-this-the-latest" check or `AbortController`.

### References:
- Jake Archibald, "Tasks, microtasks, queues and schedules" (2015) — the canonical explainer, with animations.
- MDN: "The event loop."
- Deno blog, "A brief history of JavaScript" — has the original IE5 `ActiveXObject` XHR snippet and the Gmail/AJAX timeline.
- Ryan Dahl's original Node.js talk (2009) — the whole pitch is "non-blocking I/O is why Node exists."

---
