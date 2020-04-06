var tape = require('tape')
var parse = require('../parse')
var ev = require('../eval')
var env = {
  add: function ([a, b]) { return a + b },
  sub: function ([a, b]) { return a - b },
  lt:  function ([a, b]) { return a < b }
}

var inputs = [
  '1',
  '(add 1 2)',
  '(add 4 (add 3 (add 2 (add 1 0))))',
  '[(fun (a b) { add a b }) 7 13]', // could be either spun out or inlined.
  '[{fun fib [n] (if {lt n 2} 1 (add [fib (sub n 1)] [fib (sub n 2)]))} 5]',
  '(block (def foo 17) (add foo 2))',
  '{block (def i 0) (def sum 0) (loop [lt i 10] [def sum {add sum (def i [add i 1])}])}'
]

var outputs = [
  1,
  3,
  10,
  20,
  8,
  19,
  55
]

inputs.forEach(function (_, i) {
  tape(inputs[i] + ' => ' + outputs[i], function (t) {
    var ast = parse(inputs[i])
    t.ok(ast, 'can parse')
    t.equal(ev(ast, env), outputs[i])
    t.end()
  })
})
