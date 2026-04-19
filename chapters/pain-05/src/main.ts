// Modern-TS source: types, arrow fns, this-capture inside an arrow.
// Running the transpiler on this file should produce valid ES5-ish JS.

interface Greeter {
  greeting: string;
  makeHello(): () => string;
}

type Name = string;

const greeter: Greeter = {
  greeting: 'hello',
  makeHello(): () => string {
    // Classic this-capture case: the arrow closes over Greeter's `this`.
    return () => this.greeting + ', world';
  },
};

const shout = (s: Name): string => s.toUpperCase() + '!';

console.log(shout(greeter.makeHello()() as string));
