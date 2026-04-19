// b requires a mid-evaluation → sees the partial exports: { name: 'A' } only.
console.log('b: start');
var a = require('./a');
console.log('b: saw partial a =', a);
module.exports = { name: 'B', sawA: a };
console.log('b: done');
