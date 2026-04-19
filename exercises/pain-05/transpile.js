// Toy transpiler: parse → walk → rewrite → print.
// Two passes: (1) strip TS type syntax, (2) lower arrow fns to function expressions.
// Usage: node transpile.js input.ts > out.js
var fs = require('fs');
var { Parser } = require('acorn');
var { generate } = require('astring');
var tsPlugin = require('acorn-typescript').default;

var TSParser = Parser.extend(tsPlugin());

function parse(source) {
  return TSParser.parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    locations: true,
  });
}

// Hand-rolled AST walker: calls `visit(node, parent, key, index)` for every node.
// The visitor can return a replacement node, or null to delete (only valid in arrays).
function walk(node, visit, parent, key, index) {
  if (!node || typeof node.type !== 'string') return node;
  var replacement = visit(node, parent, key, index);
  if (replacement !== undefined) return replacement;
  for (var k in node) {
    if (k === 'loc' || k === 'start' || k === 'end' || k === 'range') continue;
    var child = node[k];
    if (Array.isArray(child)) {
      for (var i = 0; i < child.length; i++) {
        var r = walk(child[i], visit, node, k, i);
        if (r === null) { child.splice(i, 1); i--; }
        else if (r !== undefined && r !== child[i]) child[i] = r;
      }
    } else if (child && typeof child.type === 'string') {
      var r2 = walk(child, visit, node, k);
      if (r2 !== undefined && r2 !== child) node[k] = r2;
    }
  }
  return node;
}

/*TODO:
  TS type-strip pass. For each node:
    - TSInterfaceDeclaration / TSTypeAliasDeclaration → drop (return null, valid in body arrays).
    - ImportDeclaration with importKind === 'type' → drop.
    - TSAsExpression / TSNonNullExpression / TSTypeAssertion → unwrap to inner .expression.
    - Any node with .typeAnnotation / .returnType / .typeParameters / .typeArguments → delete those fields.
*/

/*TODO:
  Arrow fn → function expression pass.
    - Change type to FunctionExpression.
    - If body is an expression (not a BlockStatement), wrap it as { return <expr>; }.
    - If the arrow's body uses `this`, rewrite each `this` to identifier `_this`
      and insert `var _this = this;` at the top of the nearest enclosing non-arrow
      function (or Program if none).
  Careful: don't rewrite `this` inside NESTED non-arrow functions — their `this` is their own.
*/

function transpile(source) {
  var ast = parse(source);
  stripTypes(ast);
  lowerArrows(ast);
  return generate(ast);
}

var input = process.argv[2];
if (!input) {
  console.error('usage: node transpile.js <file>');
  process.exit(1);
}
process.stdout.write(transpile(fs.readFileSync(input, 'utf8')));
