// Fake registry backed by a local directory: registry/<name>/<version>/{package.json, ...}.
var fs = require('fs');
var path = require('path');

function makeRegistry(root) {
  function versionsOf(name) {
    var dir = path.join(root, name);
    try {
      return fs.readdirSync(dir).filter(function (v) {
        return fs.statSync(path.join(dir, v)).isDirectory();
      });
    } catch (e) {
      return [];
    }
  }

  function manifestFor(name, version) {
    var p = path.join(root, name, version, 'package.json');
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }

  function dirFor(name, version) {
    return path.join(root, name, version);
  }

  return { versionsOf: versionsOf, manifestFor: manifestFor, dirFor: dirFor };
}

module.exports = { makeRegistry: makeRegistry };
