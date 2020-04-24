var Load = require('./load')
var acid = require('./')
var Env  = require('./env')
var wrap = require('./wrap')
module.exports = function (dir, memory) {
  var env = Env(memory || Buffer.alloc(65536), {0:0})
  var load = Load(dir, env)
  return function (req, opts){
    var module = load(req)
    return (opts && opts.eval ? wrap : acid.wasm)(module, env)
  }
}
