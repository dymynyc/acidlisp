var tape = require('tape')
var parse = require('../parse')
var ev = require('../eval')
var unroll = require('../unroll')
var compileWat = require('../compile/wat')
var compileJs = require('../compile/js')
var wat2wasm = require('../wat2wasm')
var stringify = require('../util').stringify
var syms = require('../symbols')

var l6 = require('../')

//var flatten = require('../flatten')
var env = {
  add: function ([a, b]) { return a + b },
  sub: function ([a, b]) { return a - b },
  lt:  function ([a, b]) { return a < b }
}

var inputs = [
  '1',
  '(add 1 2)',
  '(add 4 (add 3 (add 2 (add 1 0))))',
  '(block (def foo 17) (add foo 2))',
  '{block (def i 0) (def sum 0) (loop [lt i 10] [def sum {add sum (def i [add i 1])}])}',
]

var outputs = [
  1,
  3,
  10,
  19,
  55
]

function toModule (src) {
  return stringify([syms.module, [syms.export, [syms.fun, [], parse(src)]]])
}


inputs.forEach(function (_, i) {
  tape(inputs[i] + ' => ' + outputs[i], function (t) {
    var ast = parse(inputs[i])
    t.ok(ast, 'can parse')
    t.equal(ev(ast, env), outputs[i])
    t.end()
  })
})

inputs.forEach(function (_, i) {
  tape('js:'+inputs[i] + ' => ' + outputs[i], function (t) {
    t.equal(l6.js_eval(toModule(inputs[i]))(), outputs[i])
    t.end()
  })
})

inputs.forEach(function (_, i) {
  tape('wat:'+inputs[i] + ' => ' + outputs[i], function (t) {
    t.equal(l6.wasm(toModule(inputs[i]))(), outputs[i])
    t.end()
  })
})
