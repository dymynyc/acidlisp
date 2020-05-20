var tape = require('tape')
var {
  stringify, isNumber, isExpressionTree
} = require('../util')
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
  mul: (a, b) => a * b,
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
  '((fun R (i) (if (lt i 100) (R (add i i)) i)) 1)',
  '((fun R (i) (if (lt i 50) (R (mul i 2)) i)) 1)',
  '(if (if (sub (lt a 4) b) 10 0) 10 -10)',
  '(if [block {def x b} (if (sub (lt x 4) b) 10 0) ] 10 -10)'
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

inputs.forEach(function (_, i) {
  tape('expression:'+inputs[i], function (t) {
    var ast = parse(inputs[i])

    //assert that the evaluation result is the same
    t.equal(ev(ast, {__proto__: env}), expected[i])

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
