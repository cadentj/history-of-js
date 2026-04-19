// Toy CommonJS loader: two phases.
//   Phase 1 — mechanism: read, wrap, eval, cache, expose module/exports/require.
//   Phase 2 — resolution: turn './foo' or 'bare' into an absolute path.
var fs = require('fs');
var path = require('path');

var cache = Object.create(null);

/*TODO:
  Phase 2: given a specifier and the caller's directory, return the absolute path.
  Relative ('./foo' or '../foo'): try as-is, +'.js', +'/index.js', +'/package.json' (read "main").
  Bare ('marked'): walk up from callerDir looking for node_modules/<spec> with the same suffix tries.
  Throw "Cannot find module <spec>" if nothing matches.
*/

/*TODO:
  Phase 1: given an absolute path, return the module's exports.
  Cache by absolute path. Crucially, populate the cache BEFORE evaluating —
  that's what lets circular requires return partially-initialized exports.
  Wrap the source in `(function (module, exports, require, __filename, __dirname) { ... })`
  and eval it. Call the wrapped function with a fresh module object and a
  scopedRequire that resolves relative specifiers from this file's directory.
*/

module.exports = toyRequire;
module.exports.cache = cache;
