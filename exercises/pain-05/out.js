const greeter = {
  greeting: 'hello',
  makeHello() {
    var _this = this;
    return function () {
      return _this.greeting + ', world';
    };
  }
};
const shout = function (s) {
  return s.toUpperCase() + '!';
};
console.log(shout(greeter.makeHello()()));
