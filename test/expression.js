var tape = require('tape')
var {
  flatten, stringify, isNumber, isExpressionTree
} = require('../util')
var parse = require('../parse')
var ev = require('../eval')
var compileWat = require('../compile/wat')
var wat2wasm = require('../wat2wasm')

var env = {
  a: 7, b: 0, d: 0, e: 0, f: 1,
  and: ([a]) => a & 1,
  add: ([a, b])=> a + b,
  lt: ([a, b]) => a < b
}

var inputs = [
  '(add 1 2)',
  '(if a 1 2)',
  '(add (if a 3 2) 5)',
  '(if a (if b 2 1) 0)', //(AND a b)
  '(if d 1 (if e 1 0))', //(OR d e)
  '(if d 1 (if e 1 (if f 1 0)))', //(OR d e)
  '(block (def i 1) (loop (lt i 100) (def i (add i i))))',
  '(block (def i 1) (loop (if (lt i 50) 1 0) (def i (add i i))))'
]

var isExprTree = [
  true,
  false,
  false,
  false,
  false,
  false,
  false,
  false
]

var outputs = [
 '(add 1 2)',
 '(block (if a (def $1 1) (def $1 2)) $1)',
 '(block (if a (def $2 3) (def $2 2)) (add $2 5))',
 '(block (if a (if b (def $1 2) (def $1 1)) (def $1 0)) $1)',
 '(block (if d (def $1 1) (if e (def $1 1) (def $1 0))) $1)',
 '(block (if d (def $1 1) (if e (def $1 1) (if f (def $1 1) (def $1 0)))) $1)',
 '(block (def i 1) (loop (lt i 100) (def $1 (def i (add i i)))) $1)',
 '(block (def i 1) (loop (block (if (lt i 50) (def $1 1) (def $1 0)) $1) (def $2 (def i (add i i)))) $2)'
]

var values = [
  3,
  1,
  8,
  1,
  0,
  1,
  128,
  64
]

tape('is expression tree', function (t) {
  inputs.forEach(function (tree, i) {
    t.equal(isExpressionTree(parse(tree)), isExprTree[i], stringify(tree) + ' should ' + (isExprTree[i] ? 'be' : 'not be') + ' an expression tree')
  })
  t.end()
})

inputs.forEach(function (_, i) {
  tape('flatten:'+inputs[i], function (t) {
    var ast = parse(inputs[i])
    console.log("tree:", stringify(ast))
    var flat_ast = flatten(parse(inputs[i]))
    console.log("flat:", stringify(flat_ast))

    //assert that the flattened tree is expected
    t.equal(stringify(flat_ast), outputs[i])

    //assert that the evaluation result is the same
    t.equal(ev(ast, {__proto__: env}), values[i])
    t.equal(ev(flat_ast, {__proto__: env}), values[i])

    //compile to webassembly and check that's the same too.
    var wat = compileWat([Symbol('module'), [Symbol('export'), [
      Symbol('fun'),
        Object.keys(env).filter(k => isNumber(env[k])).map(k => Symbol(k))
      , flat_ast]]], env)

    console.log(wat)
    var wasm = wat2wasm(wat)
    t.equal(wasm.apply(wasm,
      Object.keys(env).filter(k => isNumber(env[k])).map(k => env[k])
    ), values[i])
    t.end()
  })
})
