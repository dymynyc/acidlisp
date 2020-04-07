var tape = require('tape')
var parse = require('../parse')
var ev = require('../eval')
var compileWat = require('../compile/wat')
var compileJs = require('../compile/js')
var wat2wasm = require('../wat2wasm')
var stringify = require('../util').stringify
var flatten = require('../flatten')
var env = {
  add: function ([a, b]) { return a + b },
  sub: function ([a, b]) { return a - b },
  lt:  function ([a, b]) { return a < b }
}

var inputs = [
  '1',
  '(add 1 2)',
  '(add 4 (add 3 (add 2 (add 1 0))))',
// these require transformations... put those tests elsewhere
//  '[(fun (a b) { add a b }) 7 13]', // could be either spun out or inlined.
//  '[{fun fib [n] (if {lt n 2} 1 (add [fib (sub n 1)] [fib (sub n 2)]))} 5]',
  '(block (def foo 17) (add foo 2))',
  '{block (def i 0) (def sum 0) (loop [lt i 10] [def sum {add sum (def i [add i 1])}])}'
]

var outputs = [
  1,
  3,
  10,
  //20,
//  8,
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

function safe_eval(js) {
//  var proxy = new Proxy({
//    has: function (prop) {
//      console.log('access?', prop)
//      return false
//    }
//  })
//  with(proxy) {
//    eval(s)
//  }

  js = '(function () { var module = {exports: {}}, exports = module.exports;'+js+';return module.exports;})()'
  return eval(js)
}

inputs.forEach(function (_, i) {
  tape('js:'+inputs[i] + ' => ' + outputs[i], function (t) {
    var ast = parse(inputs[i])

//    var src = [Symbol('module'), [Symbol('export'), [Symbol('fun'), [], ast]]]
    var src = [Symbol('module'), [Symbol('export'), [Symbol('fun'), [], ast]]]
    var js = compileJs(src)
    console.log("js", js, outputs[i])
    //eval is leaking!
    var fn = eval(js)
    t.equal(fn(), outputs[i])
    t.end()
  })
})



inputs.forEach(function (_, i) {
  tape('wat:'+inputs[i] + ' => ' + outputs[i], function (t) {
    var ast = parse(inputs[i])

    var src = [Symbol('module'), [Symbol('export'), [Symbol('fun'), [], flatten(ast)]]]
    var wat = compileWat(src)
    console.log("WAT", wat)
    var module = wat2wasm(wat)
    t.equal(module(), outputs[i])
    t.end()
  })
})
