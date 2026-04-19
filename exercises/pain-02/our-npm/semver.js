// Toy semver: supports exact ("1.2.3"), caret ("^1.2.3"), tilde ("~1.2.3").
// Full spec (prereleases, build metadata) is out of scope — and a swamp.
function parse(v) {
  var parts = String(v).split('.').map(function (n) { return parseInt(n, 10) || 0; });
  return { major: parts[0], minor: parts[1] || 0, patch: parts[2] || 0 };
}

function cmp(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

function cmpStr(a, b) { return cmp(parse(a), parse(b)); }

/*TODO:
  Implement satisfies(version, range) for these three range forms:
    "1.2.3"    — exact match
    "^1.2.3"   — same major, version >= 1.2.3 (e.g. ^1 allows any 1.x.x)
    "~1.2.3"   — same major AND minor, version >= 1.2.3
  Return a boolean. Use cmp() and parse() defined above.
*/

module.exports = { satisfies: satisfies, cmpStr: cmpStr, parse: parse };
