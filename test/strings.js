var l6          = require('../')
var tape        = require('tape')
var {stringify} = require('../util')

var syms        = require('../symbols')
var unroll      = require('../unroll')
var compileWat  = require('../compile/wat')

var load = require('../load')(__dirname)
var env = load('../lib/strings.l6')
var inputs = [
  '(compare "abc" "abc")',
  '(compare "abc" "abd")',
  '(compare "abc" "abb")',
//  '(concat "hello" ", world")',
//  '(slice "hi there" 1 4)',
//  `(block
//    (def hmyj "hello mellow yellow jello")
//    (def hello (slice hmyj 0 5))
//    {join [list hello hello hello
//      (concat "h" (slice hmyj 10 12))
//      (slice hmyj 9 12)] " "})`
]

function toFun (src) {
  return stringify([syms.fun, [], l6.parse(src)])
}

function toModule (src) {
  return stringify([syms.module,
    [syms.export, [syms.fun, [], l6.parse(src)]]])
}

var outputs = [
  0,
  -1,
  1,
  Buffer.from('hello, world'),
  Buffer.from('i t'),
  Buffer.from('hello hello hello how low')
]

inputs.forEach(function (v, i) {
  tape(inputs[i] + ' => '+JSON.stringify(outputs[i].toString()), t => {
    t.equal(stringify(l6.eval(inputs[i])), stringify(outputs[i]), 'eval, correct output')

//    var r = unroll(l6.eval(toModule(inputs[i]), env))
//    console.log(compileWat(r))
    var m = toModule(inputs[i])
    t.equal(l6.wasm(m, env)(), outputs[i], 'wasm correct output')

//    t.equal(l6.js_eval(toModule(inputs[i]), env)(), outputs[i], 'javascript correct output')
    t.end()
  })
})
