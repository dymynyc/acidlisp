var tape = require('tape')
var {
  stringify, isNumber, isExpressionTree
} = require('../util')
var flatten = require('../flatten')
var parse = require('../parse')
var ev = require('../eval')
var syms = require('../symbols')
var compileWat = require('../compile/wat')
var wat2wasm = require('../wat2wasm')

var acid = require('../')

var env = {
  a: {value:7}, b: {value:0}, d: {value:0},
  e: {value:0}, f: {value:1},
//  and: (a)    => a & 1, //wtf?
  add: (a, b) => a + b,
  lt:  (a, b) => a < b,
  sub: (a, b) => a - b,
}

var inputs = [
  '(add 1 2)',
  '(if a 1 2)',
  '(add (if a 3 2) 5)',
  '(if a (if b 2 1) 0)', //(AND a b)
  '(if d 1 (if e 1 0))', //(OR d e)
  '(if d 1 (if e 1 (if f 1 0)))', //(OR d e)
  '(block (def i 1) (loop (lt i 100) (def i (add i i))))',
  '(block (def i 1) (loop (if (lt i 50) 1 0) (def i (add i i))))',
  '(if (if (sub (lt a 4) b) 10 0) 10 -10)',
  '(if [block {def x b} (if (sub (lt x 4) b) 10 0) ] 10 -10)'
]

var isExprTree = [
  true,
  false,
  false,
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
 '(block (def i 1) (loop (block (if (lt i 50) (def $1 1) (def $1 0)) $1) (def $2 (def i (add i i)))) $2)',
 '(block (if (sub (lt a 4) b) (def $1 10) (def $1 0)) (if $1 (def $1 10) (def $1 -10)) $1)',
 '(block (def x b) (if (sub (lt x 4) b) (def $1 10) (def $1 0)) (if $1 (def $1 10) (def $1 -10)) $1)'
]

var expected = [
  3,
  1,
  8,
  1,
  0,
  1,
  128,
  64,
  -10,
  10
]

var keys = Object.keys(env).filter(e => isNumber(env[e].value))
var values = keys.map(k => env[k].value)
//return console.log(keys, values, env)


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
    t.equal(ev(ast, {__proto__: env}), expected[i])
    t.equal(ev(flat_ast, {__proto__: env}), expected[i])

    t.end()
  })
})



function toModule (src) {
  return stringify([syms.module, [syms.export, [syms.fun,
    keys.map(e => Symbol(e)), parse(src)]]])
}

inputs.forEach(function (_, i) {
  tape(inputs[i] + ' => ' + expected[i], function (t) {
    var ast = parse(inputs[i])
    t.ok(ast, 'can parse')
    t.equal(ev(ast, env), expected[i])
    t.end()
  })
})


inputs.forEach(function (_, i) {
  tape('js:'+inputs[i] + ' => ' + expected[i], function (t) {
    t.equal(acid.js_eval(toModule(inputs[i])).apply(null, values), expected[i])
    t.end()
  })
})

inputs.forEach(function (_, i) {
  tape('wat:'+inputs[i] + ' => ' + expected[i], function (t) {
    t.equal(acid.wasm(toModule(inputs[i])).apply(null, values), expected[i])
    t.end()
  })
})
