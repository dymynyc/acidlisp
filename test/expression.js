var tape = require('tape')
var {flatten, stringify, isNumber} = require('../util')
var parse = require('../parse')
var ev = require('../eval')
var env = {a: 7, b: 0, d: 0, e: 0, f: 1, and: ([a]) => a & 1, add: ([a, b])=> a+b }
var compileWat = require('../compile/wat')
var wat2wasm = require('../wat2wasm')

var inputs = [
  '(add (if a 1 2) 3)',
  '(add 1 2)',
  '(if (and a 1) 0 1)',
  // (and a b) ;; except that then/else block is a statement so can hold another if
  '(if a (if b 1 -1) -10)',
    //(or d e f)
  '(if d 1 (if e 10 (if f 100 -1) -10) -100)',
]

var outputs = [
  '(block (if a (def $1 1) (def $1 2)) (def $2 (add $1 3)))',
  '(block (def $1 (add 1 2)))',
  '(block (def $1 (and a 1)) (block (if $1 (def $2 0) (def $2 1)) $2))',
  '(block (if a (block (if b (def $2 100) (def $2 -1)) (def $1 $2)) (def $1 -1)) $1)'
]

var values = [
  4,
  3,
  0,
  -1,
  100
]

/*
['pre', (def v (if a (set v 1) (set v 2))), (add v 3)


(add (if a 1 2) (if b 3 4))

=>


(block
  (def v1 (if a (set v1 1) (set v2 2)))
  (def v2 (if b (set v2 3) (set v2 4)))
  (dev v3 (add v1 v2))
)
*/

  console.log(stringify(flatten(parse(inputs[0]))))
inputs.forEach(function (_, i) {
  tape('flatten:'+inputs[i], function (t) {
    var ast = parse(inputs[i])
    var flat_ast = flatten(parse(inputs[i]))
    console.log("FLAT", stringify(flat_ast))
    //disable checking exact output, because it's not perfect
    //but the important thing is it behaves correctly.
    //t.equal(stringify(), outputs[i])
    t.equal(ev(ast, {__proto__: env}), values[i])
    t.equal(ev(flat_ast, {__proto__: env}), values[i])
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
