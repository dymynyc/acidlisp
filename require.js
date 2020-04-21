var Load = require('./load')
var acid = require('./')
var Env  = require('./env')

module.exports = function (dir) {
  var load = Load(dir, Env(Buffer.alloc(65536), {0:0}))
  return function (req) {
    return acid.wasm(load(req))
  }
}
