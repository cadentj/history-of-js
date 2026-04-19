// Entry for the toy-loaded module graph. Uses require() just like real Node.
var greet = require('./greet');
var format = require('./util/format');

module.exports = {
  greet: function (name) {
    return format(greet(name));
  }
};
