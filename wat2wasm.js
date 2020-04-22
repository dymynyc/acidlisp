var fs = require('fs')
var cp = require('child_process')

function loadWat(file) {
  var wasm = fs.readFileSync(file)
  var m = new WebAssembly.Module(wasm)
  var memory
  var instance = new WebAssembly.Instance(m, {
    system: {
       log: function (p) {
        var l = memory.readUInt32LE(p)
        console.error(memory.slice(p+4, p+4+l).toString())
        return p
      }
    }
  })

 if(instance.exports.memory)
  var memory = Buffer.from(instance.exports.memory.buffer)
  if(instance.exports.main){
    instance.exports.main.memory = memory
    return instance.exports.main
  }
  else {
    instance.exports.memory = memory
    return instance.exports
  }
}
module.exports = function (src) {
  var ts = Date.now()
  var fn_in = '/tmp/wat2wasm_'+ts+'.wat'
  var fn_out = '/tmp/wat2wasm_'+ts+'.wasm'
  fs.writeFileSync(fn_in, src)
  cp.execSync('wat2wasm '+fn_in+' -o '+fn_out)
  return loadWat(fn_out)
}
