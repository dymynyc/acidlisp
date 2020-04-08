var tape = require('tape')
var parse = require('../parse')
var ev = require('../eval')
var compileWat = require('../compile/wat')
var compileJs = require('../compile/js')
var wat2wasm = require('../wat2wasm')
var {stringify} = require('../util')
var flatten = require('../flatten')
var unroll = require('../unroll')

var env = {}

var inputs = [
` {module
    (def create {fun (x) [fun (y) (add x y)]})
    (def seven (create 7))
    (export seven)}`,

  //could expand this by either binding it, or by unrolling
` (module (export {fun (x y)
    [(fun (a b) { add a b }) (add x 7) (add y 13)]}))`, // could be either spun out or inlined.

  //self-evaluating recursive function must be unrolled.
` (module (export {fun (x)
    [(fun fib [n] (if
      {lt n 2} 1
      (add
        [fib (sub n 1)]
        [fib (sub n 2)]))) x]}))`,

]

var outputs = [
  [[[0],7], [[1], 8], [[7], 14]],
  [[[],20], [[1, 2], 23]],
  [[[5], 8], [[6], 13], [[8], 34]],
]

inputs.forEach(function (v, i) {
  tape('compile functions:'+inputs[i], function (t) {
    console.log('input:'+i)
    var start = Date.now()
    var src = parse(inputs[i])
    console.log(Date.now()-start)
    console.log('SRC', src)
    var ast = ev(src, env)

    console.log('AST', ast)

    var unrolled = unroll(ast)
    console.log('unrolled', stringify(unrolled))

    var wat = compileWat(unrolled)
    console.log("WAT", wat)
    var wasm = wat2wasm(wat)
    for(var j = 0; j < outputs[i].length; j ++) {
      var args = outputs[i][j][0]
      var expected = outputs[i][j][1]
      t.equal(wasm.apply(null, args), expected)
    }
    t.end()
  })
})
