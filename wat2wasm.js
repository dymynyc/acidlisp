var fs = require('fs')
var cp = require('child_process')

function load(file) {
  var wasm = fs.readFileSync(file)
  var m = new WebAssembly.Module(wasm)
  var instance = new WebAssembly.Instance(m)
  if(instance.exports.main)
    return instance.exports.main
  else
    return instance.exports
}
module.exports = function (src, cb) {
  var ts = Date.now()
  var fn_in = '/tmp/wat2wasm_'+ts+'.wat'
  var fn_out = '/tmp/wat2wasm_'+ts+'.wasm'
  fs.writeFileSync(fn_in, src)
  cp.execSync('wat2wasm '+fn_in+' -o '+fn_out)
  return load(fn_out)
}
