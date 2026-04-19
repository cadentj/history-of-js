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
// BEGIN:SOLUTION
function tryFile(p) {
  try {
    if (fs.statSync(p).isFile()) return p;
  } catch (e) {}
  return null;
}

function tryExtensions(base) {
  return (
    tryFile(base) ||
    tryFile(base + '.js') ||
    tryFile(base + '.json') ||
    tryDirectory(base)
  );
}

function tryDirectory(dir) {
  var pkgPath = path.join(dir, 'package.json');
  if (tryFile(pkgPath)) {
    var pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg.main) {
      var mainPath = path.join(dir, pkg.main);
      return tryFile(mainPath) || tryFile(mainPath + '.js');
    }
  }
  return tryFile(path.join(dir, 'index.js'));
}

function resolve(spec, callerDir) {
  if (spec.startsWith('./') || spec.startsWith('../') || path.isAbsolute(spec)) {
    var found = tryExtensions(path.resolve(callerDir, spec));
    if (found) return found;
  } else {
    var dir = callerDir;
    while (true) {
      var candidate = tryExtensions(path.join(dir, 'node_modules', spec));
      if (candidate) return candidate;
      var parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  throw new Error('Cannot find module ' + spec);
}
// END:SOLUTION

/*TODO:
  Phase 1: given an absolute path, return the module's exports.
  Cache by absolute path. Crucially, populate the cache BEFORE evaluating —
  that's what lets circular requires return partially-initialized exports.
  Wrap the source in `(function (module, exports, require, __filename, __dirname) { ... })`
  and eval it. Call the wrapped function with a fresh module object and a
  scopedRequire that resolves relative specifiers from this file's directory.
*/
// BEGIN:SOLUTION
function loadFromAbsolute(absPath) {
  if (cache[absPath]) return cache[absPath].exports;

  var module = { exports: {} };
  cache[absPath] = module;

  if (absPath.endsWith('.json')) {
    module.exports = JSON.parse(fs.readFileSync(absPath, 'utf8'));
    return module.exports;
  }

  var source = fs.readFileSync(absPath, 'utf8');
  var wrapped =
    '(function (module, exports, require, __filename, __dirname) {\n' +
    source +
    '\n})';
  var fn = eval(wrapped);

  var dir = path.dirname(absPath);
  function scopedRequire(spec) {
    return loadFromAbsolute(resolve(spec, dir));
  }

  fn(module, module.exports, scopedRequire, absPath, dir);
  return module.exports;
}

function toyRequire(spec, fromDir) {
  return loadFromAbsolute(resolve(spec, fromDir || process.cwd()));
}
// END:SOLUTION

module.exports = toyRequire;
module.exports.cache = cache;
