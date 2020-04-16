var fs = require('fs')
var hexpp = require('hexpp')
var {
  isFunction, isNumber, readBuffer
} = require('./util')

function loadWat(file) {
  var wasm = fs.readFileSync(file)
  var m = new WebAssembly.Module(wasm)
  var instance = new WebAssembly.Instance(m)
  if(instance.exports.main) {
    instance.exports.main.memory = Buffer.from(instance.exports.memory.buffer)
    return instance.exports.main
  }
  else {
    instance.exports.memory = Buffer.from(instance.exports.memory.buffer)
    return instance.exports
  }
}

function toArgs (args) {
}

function call (m, fn, args) {
  var i = 128
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
  var file = opts._.shift()
  var m = loadWat(file)

  if(isFunction(m)) {
    console.log(call(m, m, opts._))
    return
  }

  var cmd = opts._.shift()
  if(isFunction(m[cmd])) {
    console.log(call(m, m[cmd], opts._))
    console.log(hexpp(Buffer.from(m.memory.buffer.slice(0, 256))))
    return
  }
  else {
    console.error('unknown command:'+cmd+', available commands:'+Object.keys(m).filter(e => isFunction(m[e])))
    process.exit(1)
  }
}
