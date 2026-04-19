---
outline: deep
title: "13. Imperative DOM updates don't scale"
---

jQuery-era code: a click handler reads state from the DOM, computes new state, writes it back to the DOM. With many interacting pieces of state, you get a spaghetti of "if this element changes, remember to update those three other elements." Bugs are inevitable.

**Why it matters historically:** motivated **declarative UI frameworks** — React (2013), Vue (2014), Svelte (2016). The shared idea: you describe what the UI *should look like* given the current state, the framework figures out what DOM operations to perform. This is the single biggest shift in how frontend code is written in the last 15 years.

**Chat app step:** a single message send has to coordinate many pieces of UI. The send button disables while the request is in flight. The input clears optimistically. The user's message appears immediately with a "sending" marker. If the request fails, an error overlay shows and the message gets a retry button. The sidebar updates with a new conversation title. Scroll follows the latest message. Meanwhile the settings pane, model picker, and theme toggle have their own state. Imperative DOM is unmanageable — we keep forgetting one of the updates. We write a ~50-line signals-based reactive runtime (`signal`, `effect`, `derived`) and refactor the UI on top of it. Everything updates coherently because each piece just reads the signals it cares about.

**Tie to JS:** chat UIs are the ideal place to feel this pain — every state change touches three other things. Writing the 50-line signals runtime makes React/Vue/Svelte stop being "frameworks you learn" and start being "solutions to a problem you've had." Those 50 lines are the core of SolidJS.

**V8 puzzle (optional, discoverable):** the naive signals impl we wrote is ~10x slower than it should be. Target: 5x speedup. Give them `node --trace-deopt` — the output literally says "wrong map" when a hidden class changes on a hot path. `node --allow-natives-syntax` + `%DebugPrint(node)` shows the map pointer directly. The planted bug: `createNode` adds a `.computed` field conditionally, so two hidden classes feed the same `updateNode` call site — the fix is initializing `.computed = null` up front so the shape is stable from birth. Students end up reading a real V8 deopt trace instead of being told "trust me, hidden classes matter."

---
