var parse      = require('./parse')
var ev         = require('./eval')
var unroll     = require('./unroll')
var wat        = require('./compile/wat')
var wat2wasm   = require('./wat2wasm')
var js         = require('./compile/js')
var env        = require('./env')
var {
  isString, isArray
} = require('./util')

exports.bind = ev.band
exports.parse = parse

function envify(ary) {
  if(!isArray(ary)) return ary
  var _env = {}
  ary.forEach(([k, v]) => _env[k.description] = v)
  return _env
}

function evalIf(src, _env) {
  _env = envify(_env||env)
  return isString(src) ? ev(ev.bind(parse(src),  _env), _env) : src
}
exports.eval = evalIf

exports.js_eval = function (src, env) {
  return eval(exports.js(src, env))
}

exports.js = function (src, env) {
  return js(unroll(evalIf(src, env)))
}

exports.wat = function (src, env) {
  return wat(unroll(evalIf(src, env)))
}

exports.wasm = function (src, env) {
  return wat2wasm(exports.wat(src, env))
}
