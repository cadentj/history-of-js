// Bootstrap: use the toy require to load a small app tree, then demo circular deps.
var path = require('path');
var toyRequire = require('./require');

var main = toyRequire('./app/main', __dirname);
console.log('app/main →', main.greet('world'));

console.log('--- circular demo ---');
toyRequire('./circular/a', __dirname);
