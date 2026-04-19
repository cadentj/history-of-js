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

module.exports = { resolve: resolve };
