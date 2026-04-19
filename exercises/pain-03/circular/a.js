// a.js and b.js require each other. The snapshot b sees of `a.exports` is
// whatever a has assigned BEFORE the require('./b') line — a classic CJS gotcha.
console.log('a: start');
exports.name = 'A';
var b = require('./b');
console.log('a: got b =', b);
exports.done = true;
console.log('a: done');
