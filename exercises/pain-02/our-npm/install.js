// Copy each resolved package's files from registry/<name>/<version>/ → node_modules/<name>/.
var fs = require('fs');
var path = require('path');

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  fs.readdirSync(src).forEach(function (entry) {
    var s = path.join(src, entry);
    var d = path.join(dst, entry);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  });
}

function install(tree, registry, projectDir) {
  var nm = path.join(projectDir, 'node_modules');
  fs.rmSync(nm, { recursive: true, force: true });
  for (var name in tree) {
    copyDir(registry.dirFor(name, tree[name]), path.join(nm, name));
  }
}

module.exports = { install: install };
