var tape = require('tape')
var {stringify} = require('../util')
var l6 = require('../')

var env = {}

var inputs = [
` {module
    (def create {fun (x) [fun (y) (add x y)]})
    (def seven (create 7))
    (export seven)}`,

  //could expand this by either binding it, or by unrolling
` (module (export {fun (x y)
    [(fun (a b) {add a b}) (add x 7) (add y 13)]}))`, // could be either spun out or inlined.

  //self-evaluating recursive function must be unrolled.
` (module (export {fun (x)
    [(fun fib [n] (if
      {lt n 2} 1
      (add
        [fib (sub n 1)]
        [fib (sub n 2)]))) x]}))`,

]

var outputs = [
  [[[0],7], [[1], 8], [[7], 14] ],
  [[[0, 0],20], [[1, 2], 23] ],
  [[[5], 8], [[6], 13], [[8], 34], [[20], 10946], [[35], 14930352] ],
]

function makeTest(name, i, compiler) {
  tape(name+', compile functions:'+inputs[i], function (t) {
//    var env = createEnv(Buffer.alloc(65536), {0:0})
    //console.log('input', i, inputs[i])
    var module = compiler(inputs[i])
    for(var j = 0; j < outputs[i].length; j ++) {
      var args = outputs[i][j][0]
      var expected = outputs[i][j][1]
      var start = Date.now()
      var actual = module.apply(null, args)
      console.log(Date.now() - start)
      t.equal(actual, expected)
    }
    t.end()
  })
}
inputs.forEach(function (v, i) {
  makeTest('js', i, l6.js_eval)
//  makeTest('wasm', i, l6.wasm)
})
