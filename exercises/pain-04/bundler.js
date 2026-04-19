// Toy Browserify-shaped bundler: walk require() graph from entry, emit one file.
// Usage: node bundler.js src/main.js > bundle.js
var fs = require('fs');
var path = require('path');

function findRequireSpecs(source) {
  var specs = [];
  var re = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  var m;
  while ((m = re.exec(source))) specs.push(m[1]);
  return specs;
}

function resolveRelative(spec, callerDir) {
  var base = path.resolve(callerDir, spec);
  var tries = [base, base + '.js', path.join(base, 'index.js')];
  for (var i = 0; i < tries.length; i++) {
    try { if (fs.statSync(tries[i]).isFile()) return tries[i]; } catch (e) {}
  }
  throw new Error('Cannot resolve ' + spec + ' from ' + callerDir);
}

/*TODO:
  Walk the require() graph starting at entryPath:
    - Assign each unique absolute path an integer id (start at 0).
    - For each module: record its source, and a { spec: id } map for its require calls.
    - Queue newly discovered deps and process them.
  Return { modules: { id: { code, deps } }, entryId }.
*/

/*TODO:
  Emit the bundle:
    - For each module, wrap its source in:
        function (module, exports, require) { <source> }
    - Rewrite each require("./foo") → require(<id>) using the deps map.
    - Ship a tiny runtime that calls require(entryId).
*/

var entry = process.argv[2];
if (!entry) {
  console.error('usage: node bundler.js <entry>');
  process.exit(1);
}
process.stdout.write(emit(buildGraph(entry)));
