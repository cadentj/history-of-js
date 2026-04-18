#!/usr/bin/env node
var fs = require('fs');
var path = require('path');

function stripTypeAnnotations(source) {
  /* TODO: implement this section */
}

function transpileFile(inputPath, outputPath) {
  var src = fs.readFileSync(inputPath, 'utf8');
  var out = stripTypeAnnotations(src);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, out, 'utf8');
}

if (require.main === module) {
  var inputPath = path.resolve(process.argv[2] || 'src/index.ts');
  var outputPath = path.resolve(process.argv[3] || 'dist/index.js');
  transpileFile(inputPath, outputPath);
}

module.exports = {
  stripTypeAnnotations: stripTypeAnnotations,
  transpileFile: transpileFile
};
