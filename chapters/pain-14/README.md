---
outline: deep
title: "14. Node-isms don't run on the edge or in the browser"
---

Node has `fs`, `path`, `process`, `Buffer`, a specific module resolution algorithm, CJS by default. None of this exists in Cloudflare Workers, Deno, or the browser. Code written for Node doesn't port.

**Why it matters historically:** motivated the **Web-Standard APIs** push — runtimes agreeing on `fetch`, `Request`, `Response`, `ReadableStream` as the common vocabulary. Deno (2020) and Bun (2022) both ship Web APIs as first-class. Node has been back-porting them (`fetch` landed in Node 18). This is an active, ongoing realignment.

**Chat app step:** our proxy runs on a VPS — always-on, bills by the hour even when idle, boot time for deploys. Port it to Cloudflare Workers: per-request billing, instant cold start, closer to users. Problems: the proxy uses `fs.readFileSync` to load prompt templates and `http` for server setup — neither exists on Workers. Migrate prompt loading to `fetch` from a Worker KV binding; swap the `http` server for the Worker `fetch` handler signature. Everything else — `Request`, `Response`, `URL`, `Headers`, `fetch` — already works, because Node back-ported them.

**Tie to JS:** every `fs` call you replace is a lesson in why runtimes are converging on web-standard APIs. Also a good moment to discuss why Workers are especially well-suited to LLM proxies (cheap, global, short-lived).

---
