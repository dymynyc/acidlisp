var parse    = require('./parse')
var ev       = require('./eval')
var unroll   = require('./unroll')
var wat      = require('./compile/wat')
var wat2wasm = require('./wat2wasm')
var js       = require('./compile/js')
var {stringify} = require('./util')

exports.js_eval = function (src) {
  return eval(exports.js(src))
}

exports.js = function (src) {
  return js(unroll(ev(parse(src), {})))
}

exports.wat = function (src) {
  return wat(unroll(ev(parse(src), {})))
}

exports.wasm = function (src) {
  return wat2wasm(exports.wat(src))
}
