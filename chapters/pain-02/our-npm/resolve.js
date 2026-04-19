// Backtracking resolver: given a root manifest, return { name: version } or throw.
// Picks highest-matching candidate first; backtracks when a nested dep conflicts.
var semver = require('./semver');

/*TODO:
  Implement resolve(rootManifest, registry) → { name: version, ... }.

  Approach (recursive backtracking):
    - Start with constraints = { name: [ranges] } seeded from rootManifest.dependencies.
    - Recurse over "remaining names to pick":
        - candidates = registry.versionsOf(name) filtered by ALL current ranges,
          sorted highest-first.
        - For each candidate:
            - Load its manifest; merge its deps' ranges into a new constraints copy.
            - Check feasibility for every affected dep (at least one version matches all ranges).
              If not, skip this candidate — try the next (this is the "backtrack").
            - Add any newly-seen dep names to the remaining queue.
            - Recurse. If it returns a full assignment, return it. Else try next candidate.
    - If no candidate of `name` works, return null so the caller backtracks on *its* choice.

  Throw "No resolution for <manifest.name>" if the top-level call returns null.
*/
// BEGIN:SOLUTION
function feasible(ranges, registry, name) {
  var versions = registry.versionsOf(name);
  for (var i = 0; i < versions.length; i++) {
    var ok = true;
    for (var j = 0; j < ranges.length; j++) {
      if (!semver.satisfies(versions[i], ranges[j])) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

function pickFor(name, remaining, chosen, constraints, registry) {
  var candidates = registry.versionsOf(name)
    .filter(function (v) {
      return constraints[name].every(function (r) { return semver.satisfies(v, r); });
    })
    .sort(function (a, b) { return -semver.cmpStr(a, b); });

  for (var i = 0; i < candidates.length; i++) {
    var version = candidates[i];
    var manifest = registry.manifestFor(name, version);
    var deps = manifest.dependencies || {};

    var newConstraints = {};
    for (var k in constraints) newConstraints[k] = constraints[k].slice();

    var newRemaining = remaining.slice();
    var conflict = false;
    for (var dep in deps) {
      newConstraints[dep] = (newConstraints[dep] || []).concat([deps[dep]]);
      if (!feasible(newConstraints[dep], registry, dep)) { conflict = true; break; }
      if (!chosen[dep] && newRemaining.indexOf(dep) === -1) newRemaining.push(dep);
    }
    if (conflict) continue;

    var newChosen = {};
    for (var c in chosen) newChosen[c] = chosen[c];
    newChosen[name] = version;

    var result = step(newRemaining, newChosen, newConstraints, registry);
    if (result) return result;
  }
  return null;
}

function step(remaining, chosen, constraints, registry) {
  if (remaining.length === 0) return chosen;
  var name = remaining[0];
  var rest = remaining.slice(1);
  return pickFor(name, rest, chosen, constraints, registry);
}

function resolve(rootManifest, registry) {
  var constraints = {};
  var remaining = [];
  var deps = rootManifest.dependencies || {};
  for (var name in deps) {
    constraints[name] = [deps[name]];
    remaining.push(name);
  }
  var result = step(remaining, {}, constraints, registry);
  if (!result) throw new Error('No resolution for ' + rootManifest.name);
  return result;
}
// END:SOLUTION

module.exports = { resolve: resolve };
