// CLI: `node our-npm/index.js <project-dir>`. Reads the project's package.json,
// resolves deps against our fake registry, lays out node_modules/.
var path = require('path');
var fs = require('fs');
var makeRegistry = require('./registry').makeRegistry;
var resolve = require('./resolve').resolve;
var install = require('./install').install;

var projectDir = path.resolve(process.argv[2] || '.');
var manifest = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'));
var registry = makeRegistry(path.join(__dirname, '..', 'registry'));

var tree = resolve(manifest, registry);
console.log('resolved:');
for (var name in tree) console.log('  ' + name + '@' + tree[name]);

install(tree, registry, projectDir);
console.log('installed → ' + path.join(projectDir, 'node_modules'));
