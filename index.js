var parse    = require('./parse')
var ev       = require('./eval')
var unroll   = require('./unroll')
var wat      = require('./compile/wat')
var wat2wasm = require('./wat2wasm')
var js       = require('./compile/js')
var {stringify} = require('./util')


exports.eval = function (src, env) {
  console.log(stringify(parse(src)))
  return ev(parse(src), env || {})
}

exports.js_eval = function (src, env) {
  return eval(exports.js(src, env))
}

exports.js = function (src, env) {
  return js(unroll(ev(parse(src), env || {})))
}

exports.wat = function (src, env) {
  return wat(unroll(ev(parse(src), env ||{})))
}

exports.wasm = function (src, env) {
  return wat2wasm(exports.wat(src, env))
}
