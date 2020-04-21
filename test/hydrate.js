
var tape      = require('tape')
var parse     = require('../parse')
var createEnv = require('../env')
var ev        = require('../eval')
var hydrate   = require('../hydrate')
var unroll    = require('../unroll')
var wat       = require('../compile/wat')
var wat2wasm  = require('../wat2wasm')

var Import    = require('../load')

var inputs = [
`
(module
  (def HELLO "hello world")
  (def strings (import "../lib/strings"))
  (def hello_length {fun () (strings.length HELLO)})
  (export hello_length)
)
`
]

tape('hydrate', (t) => {
  var mem = Buffer.alloc(1024)
  var globals = {0:0}
  var ast = parse(inputs[0])
  var _env = createEnv(mem, globals)
  var env = {__proto__: _env, import: Import(__dirname, _env)}
  //hydrate sets globals and puts literals in memory
  //but not function references
  hydrate(ast, env)

  var l = "hello world".length

  t.equal(mem.readUInt32LE(4), l)
  t.equal(mem.toString('utf8', 8, 8+l), "hello world")

  var src = wat(unroll(ev(ast, env)), env)
  console.log("SRC", src)
  return t.end()
  var fn = wat2wasm(src)
  t.equal(fn(), 11)
  t.end()
})
