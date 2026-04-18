#!/usr/bin/env node
var fs = require('fs');
var path = require('path');

function bundle(entryFile, outFile) {
  var src = fs.readFileSync(entryFile, 'utf8');

  /* BEGIN_PROBLEM_EXCLUDE */
  var wrapped = [
    '(function(){',
    src,
    '})();',
    ''
  ].join('\n');

  fs.writeFileSync(outFile, wrapped, 'utf8');
  /* END_PROBLEM_EXCLUDE */
}

if (require.main === module) {
  var entry = path.resolve(process.argv[2] || 'src/index.js');
  var out = path.resolve(process.argv[3] || 'dist/bundle.js');

  fs.mkdirSync(path.dirname(out), { recursive: true });
  bundle(entry, out);
}

module.exports = { bundle: bundle };
