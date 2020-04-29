var Load = require('./load')
var acid = require('./')
var Env  = require('./env')
var wrap = require('./wrap')
module.exports = function (dir, memory, imports) {
  var env = Env(memory || Buffer.alloc(65536), {0:0}, imports)
  var load = Load(dir, env, null, imports)
  return function (req, opts){
    var module = load(req)
    return (opts && opts.eval ? wrap : acid.wasm)(module, env, null, imports)
  }
}
