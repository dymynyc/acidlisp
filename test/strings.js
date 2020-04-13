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

  '(equal_at "abc" 0 "abc" 0 3)',
  '(equal_at "abc" 0 "abd" 0 3)',
  '(equal_at "abc" 0 "abb" 0 2)',

//  `(block
//    (def hmyj "hello mellow yellow jello")
//    (def hello (slice hmyj 0 5))
//    {join [list
//      hello hello hello
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
//  Buffer.from('hello hello hello how low'),
  1,
  0,
  1
]

inputs.forEach(function (v, i) {
  tape(inputs[i] + ' => '+JSON.stringify(outputs[i].toString()), t => {
    var value = l6.eval(inputs[i])
    if('boolean' === typeof value)
      t.equal(value, !!outputs[i], 'eval, correct output')
    else
      t.equal(stringify(value), stringify(outputs[i]), 'eval, correct output')

    var m = toModule(inputs[i])
    try {
      var fn = l6.wasm(m, env)
    } catch (e) {
      console.log(l6.wat(m, env))
      throw e
    }
    if(isBuffer(outputs[i])) {
      var ptr = fn()
      t.deepEqual(readBuffer(fn.memory, ptr), outputs[i])
    }
    else
      t.equal(l6.wasm(m, env)(), outputs[i], 'wasm correct output')
    t.end()
  })
})
