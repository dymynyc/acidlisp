var parse    = require('./parse')
var ev       = require('./eval')
var unroll   = require('./unroll')
var wat      = require('./compile/wat')
var wat2wasm = require('./wat2wasm')
var js       = require('./compile/js')


exports.js = function (src) {
  throw new Error('not yet implemented')
}

exports.wat = function (src) {
  var v = src
  console.log('parse ', v = parse(v))
  console.log('eval  ', v = ev(v, {}))
  console.log('unroll', v = unroll(v))
  console.log('wat   ', v = wat(v))
  return v
  //return wat(unroll(ev(parse(src), {})))
}

exports.wasm = function (src) {
  return wat2wasm(exports.wat(src))
}
