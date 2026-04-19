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
// BEGIN:SOLUTION
function stripTypes(ast) {
  walk(ast, function (node) {
    if (node.type === 'TSInterfaceDeclaration' || node.type === 'TSTypeAliasDeclaration') return null;
    if (node.type === 'ImportDeclaration' && node.importKind === 'type') return null;
    if (node.type === 'TSAsExpression' || node.type === 'TSNonNullExpression' || node.type === 'TSTypeAssertion') {
      return node.expression;
    }
    if (node.typeAnnotation) delete node.typeAnnotation;
    if (node.returnType) delete node.returnType;
    if (node.typeParameters) delete node.typeParameters;
    if (node.typeArguments) delete node.typeArguments;
  });
}
// END:SOLUTION

/*TODO:
  Arrow fn → function expression pass.
    - Change type to FunctionExpression.
    - If body is an expression (not a BlockStatement), wrap it as { return <expr>; }.
    - If the arrow's body uses `this`, rewrite each `this` to identifier `_this`
      and insert `var _this = this;` at the top of the nearest enclosing non-arrow
      function (or Program if none).
  Careful: don't rewrite `this` inside NESTED non-arrow functions — their `this` is their own.
*/
// BEGIN:SOLUTION
function rewriteThisInArrow(body) {
  var found = false;
  walk(body, function (node) {
    if (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') {
      // don't descend — nested non-arrow fn rebinds `this`
      return node;
    }
    if (node.type === 'ThisExpression') {
      found = true;
      return { type: 'Identifier', name: '_this' };
    }
  });
  return found;
}

function findCaptureTarget(stack) {
  for (var i = stack.length - 1; i >= 0; i--) {
    var n = stack[i];
    if (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression') return n.body;
    if (n.type === 'Program') return n;
  }
  return null;
}

function alreadyCaptured(block) {
  return block.body.some(function (s) {
    return s.type === 'VariableDeclaration' &&
      s.declarations.length === 1 &&
      s.declarations[0].id.type === 'Identifier' &&
      s.declarations[0].id.name === '_this';
  });
}

function lowerArrows(ast) {
  var stack = [];
  (function recur(node, parent, key, index) {
    if (!node || typeof node.type !== 'string') return;

    if (node.type === 'ArrowFunctionExpression') {
      if (node.body.type !== 'BlockStatement') {
        node.body = { type: 'BlockStatement', body: [{ type: 'ReturnStatement', argument: node.body }] };
      }
      var usedThis = rewriteThisInArrow(node.body);
      node.type = 'FunctionExpression';
      node.id = node.id || null;
      if (usedThis) {
        var target = findCaptureTarget(stack);
        if (target && !alreadyCaptured(target)) {
          target.body.unshift({
            type: 'VariableDeclaration',
            kind: 'var',
            declarations: [{
              type: 'VariableDeclarator',
              id: { type: 'Identifier', name: '_this' },
              init: { type: 'ThisExpression' },
            }],
          });
        }
      }
    }

    stack.push(node);
    for (var k in node) {
      if (k === 'loc' || k === 'start' || k === 'end' || k === 'range') continue;
      var child = node[k];
      if (Array.isArray(child)) {
        for (var i = 0; i < child.length; i++) recur(child[i], node, k, i);
      } else if (child && typeof child.type === 'string') {
        recur(child, node, k);
      }
    }
    stack.pop();
  })(ast);
}
// END:SOLUTION

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
