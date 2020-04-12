var l6          = require('../')
var tape        = require('tape')

var syms        = require('../symbols')
var unroll      = require('../unroll')
var compileWat  = require('../compile/wat')

var {
  stringify, isBuffer
} = require('../util')

var load = require('../load')(__dirname)
var env = load('../lib/strings.l6')
var inputs = [
  '(compare "abc" "abc")',
  '(compare "abc" "abd")',
  '(compare "abc" "abb")',
  '(concat "hello" ", world")',
  '(slice "hi there" 1 4)',
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

function readBuffer(memory, ptr) {
  var len = memory.readUInt32LE(ptr)
  return memory.slice(4+ptr, 4+ptr+len)
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
    try {
    var fn = l6.wasm(m, env)
    } catch (e) {
      console.log(l6.wat(m, env))
      throw e
    }
    if(isBuffer(outputs[i])) {
      var ptr = fn()
      console.log(fn.memory)
      t.deepEqual(readBuffer(fn.memory, ptr), outputs[i])
    }
    else
      t.equal(l6.wasm(m, env)(), outputs[i], 'wasm correct output')

//    t.equal(l6.js_eval(toModule(inputs[i]), env)(), outputs[i], 'javascript correct output')
    t.end()
  })
})
