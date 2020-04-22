var Load = require('./load')
var acid = require('./')
var Env  = require('./env')

module.exports = function (dir) {
  var env = Env(Buffer.alloc(65536), {0:0})
  var load = Load(dir, env)
  return function (req) {
    return acid.wasm(load(req), env)
  }
}
