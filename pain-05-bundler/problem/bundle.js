#!/usr/bin/env node
var fs = require('fs');
var path = require('path');

function bundle(entryFile, outFile) {
  var src = fs.readFileSync(entryFile, 'utf8');

  /* TODO: implement this section */
}

if (require.main === module) {
  var entry = path.resolve(process.argv[2] || 'src/index.js');
  var out = path.resolve(process.argv[3] || 'dist/bundle.js');

  fs.mkdirSync(path.dirname(out), { recursive: true });
  bundle(entry, out);
}

module.exports = { bundle: bundle };
