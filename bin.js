#! /usr/bin/env node
var acid = require('./')
var path = require('path')
var fs = require('fs')
var createEnv = require('./env')
var createImport = require('./load')
var unroll = require('./unroll')
var Wasm = require('./wasm')
var {
  pretty,stringify,isBuffer,isNumber,readBuffer,isFunction
} = require('./util')

function call (m, fn, args) {
  //XXX call into memory allocator do do this properly!
  var i = 32*1024
  if(m.memory)
    var memory = Buffer.from(m.memory.buffer)
  args = args.map(e => {
    if(!isNaN(+e)) return +e
    var b = Buffer.from(e)
    memory.writeUInt32LE(e.length, i)
    b.copy(memory, 4 + i)
    var _i = i
    i += 4 + e.length
    return _i
  })
  return fn.apply(null, args)
}


if(!module.parent) {
  var opts = require('minimist')(process.argv.slice(2))
  //console.error(opts)
  var argv = opts._
  var cmd = argv.shift()
  var file = argv.shift()

  var env = createEnv(Buffer.alloc(65536), {0:0})
  var load = createImport(process.cwd(), env)
  if(!file)
    return console.error('acid {relative_path} > out.wat')
  //convert to a relative path
  if(!/^\.\.?\//.test(file)) file = './'+file

  if(cmd == 'parse')
    console.log(pretty(acid.parse(fs.readFileSync(file, 'utf8'))))
  else if(cmd === 'eval')
    console.log(pretty(unroll(load(file))))
  else if(cmd === 'js')
    console.log(acid.js(load(file)), env)
  else if(cmd === 'wat') {
    if(opts.fold || opts.sexp)
      console.log(acid.wat(load(file), env))
    else
      console.log(acid.watStack(load(file), env))
  }
  else if(cmd === 'run') {
    var m = Wasm(fs.readFileSync(file))
    var fn_name = argv[0]
    if(isBuffer(m[fn_name]))
      console.log(m[fn_name])
    else if(isFunction(m))
      console.log(call(m, m, argv))
    else if(isFunction(m[fn_name])) {
      console.log(call(m, m[fn_name], argv.slice(1)))
    }
    else {
      console.error('unknown command:'+fn_name+', available commands:'+Object.keys(m).filter(e => isFunction(m[e])))
      process.exit(1)
    }
  }
}
