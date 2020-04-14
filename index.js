var parse      = require('./parse')
var ev         = require('./eval')
var unroll     = require('./unroll')
var wat        = require('./compile/wat')
var wat2wasm   = require('./wat2wasm')
var js         = require('./compile/js')
var hydrate    = require('./hydrate')
var createEnv  = require('./env')
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

function defaultEnv () {
  return createEnv(Buffer.alloc(0), {0:0})
}

function evalIf(src, env) {
  env = envify(env || createEnv())
  return isString(src) ? ev(ev.bind(hydrate(parse(src), env),  env), env) : src
}
exports.eval = evalIf

exports.js_eval = function (src, env) {
  return eval(exports.js(src, env))
}

exports.js = function (src, env) {
  return js(unroll(evalIf(src, env)))
}

exports.wat = function (src, env) {
  env = env || defaultEnv()
  return wat(unroll(evalIf(src, env)), env)
}

exports.wasm = function (src, env) {
  env = env || defaultEnv()
  return wat2wasm(exports.wat(src, env))
}
