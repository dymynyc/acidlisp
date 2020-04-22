var fs = require('fs')
var cp = require('child_process')
var Wasm = require('./wasm')

module.exports = function (src) {
  var ts = Date.now()
  var fn_in = '/tmp/wat2wasm_'+ts+'.wat'
  var fn_out = '/tmp/wat2wasm_'+ts+'.wasm'
  fs.writeFileSync(fn_in, src)
  cp.execSync('wat2wasm '+fn_in+' -o '+fn_out)
  return Wasm(fs.readFileSync(fn_out))
}
