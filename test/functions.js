var tape = require('tape')
var {stringify} = require('../util')
var acid = require('../')
var wrap = require('../wrap')

var env = require('../env')()

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
  //fib. these get pretty heavy.
  //a compiler will skip the rest once
  //these get over 100ms
  [
    [[5], 8],
    [[6], 13],
    [[8], 34],
    [[20], 10946],
    [[21], 17711], //these go slow enough on interpreter already.
    [[25], 121393],
    [[35], 14930352]
  ],
]

function makeTest(name, i, compiler) {
  tape(name+', compile functions:'+inputs[i], function (t) {
    var module = compiler(inputs[i], env)
    for(var j = 0; j < outputs[i].length; j ++) {
      var args = outputs[i][j][0]
      var expected = outputs[i][j][1]
      var start = Date.now()
      var actual = module.apply(null, args)
      var time = Date.now() - start
      console.log(stringify(args)+'=>'+stringify(actual)+' ('+time+'ms)')
      t.equal(actual, expected)
      if(time > 100) break;
    }
    t.end()
  })
}
inputs.forEach(function (v, i) {
  makeTest('eval', i, function (ast, scope) {
    return wrap(acid.eval(ast, scope), scope)
  })
  makeTest('js', i, acid.js_eval)
  makeTest('wasm', i, acid.wasm)
})
