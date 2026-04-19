---
outline: deep
title: "7. Sending 400 files to the browser is slow"
---

HTTP/1.1 limits concurrent requests. Each request has overhead. A naive "one file per module" browser loader means a waterfall of hundreds of requests before your app boots.

**Why it matters historically:** the practical argument for bundlers. Even after async module loading was possible (AMD, then native ESM), bundling stuck around because one request for a concatenated file beats a hundred requests for tiny files. HTTP/2 multiplexing weakened this argument but didn't kill it.

**Chat app step:** try shipping the chat app using native `<script type="module">` + `import`. It works — but the network tab shows a cascading waterfall of requests as the browser resolves the import chain through marked, our modules, and their transitive deps. We re-enable the bundler and the app loads in one round trip.

**Tie to JS:** bundlers aren't just a module-system hack — they're a performance tool, independent of whether the browser supports modules natively. Why bundling survived ESM shipping.

---
