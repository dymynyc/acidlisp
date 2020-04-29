var tape   = require('tape')
var acid   = require('../')
var Env    = require('../env')
var unroll = require('../unroll')
var {readBuffer} = require('../util')
var wrap = require('../wrap')
var src = `(module
  (def log (system "system" "log" (string)))

  (export (fun (x) (if x (log "hello world!"))))
)`

tape('error if system import is not provided', function (t) {
  var imports = {}
  var memory = Buffer.alloc(65536)
  var env = Env(memory, {0:0}, {}, imports)
  var evalled = acid.eval(src, env)
  var m = wrap(evalled, env)
  try { m(); t.ok(false, 'expected throw') }
  catch (err) { t.ok(true, 'throw error') }

  imports.system = {}
  try { m(); t.ok(false, 'expected throw') }
  catch (err) { t.ok(true, 'throw error') }
  var logged
  imports.system.log = function (msg) {
    console.error(logged = readBuffer(memory, msg).toString())
    return 0
  }

  //must pass it something because I
  //declared it as taking an argument
  m(1)
  t.ok(logged)

  console.log(acid.wat(evalled, env))
  t.end()
})
