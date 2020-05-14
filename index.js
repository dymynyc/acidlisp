var parse      = require('./parse')
var ev         = require('./eval')
var unroll     = require('./unroll')
var Wat        = require('./compile/wat')
var WatStack   = require('./compile/wat-stack')
var wat2wasm   = require('./wat2wasm')
var js         = require('./compile/js')
var hydrate    = require('./hydrate')
var createEnv  = require('./env')
var {
  isString, isArray
} = require('./util')

exports.bind = function (ast, env) {
  return ev.bind(ast, envify(env))
}
exports.parse = parse

function envify(ary) {
  if(!isArray(ary)) return ary
  var _env = {}
  ary.forEach(([k, v]) => _env[k.description] = v)
  return _env
}

function evalIf(src, env, filename) {
  env = envify(env || createEnv())
  return isString(src) ? ev(hydrate(parse(src, filename), env), env) : src
}

//always eval.
exports.eval = function (src, env, filename) {
  env = envify(env || createEnv())
  return isString(src) ? ev(hydrate(parse(src, filename), env), env) : ev(src, env)
}

exports.js_eval = function (src, env, filename) {
  return eval(exports.js(src, env, filename))
}

exports.js = function (src, env, filename) {
  return js(unroll(evalIf(src, env, filename)))
}

exports.wat = function (src, env, filename) {
  env = env || createEnv()
  return Wat(unroll(evalIf(src, env, filename)), env)
}
exports.watStack = function (src, env, filename) {
  env = env || createEnv()
  return WatStack(unroll(evalIf(src, env, filename)), env)
}

exports.wasm = function (src, env, filename, imports) {
  env = env || createEnv()
  return wat2wasm(exports.watStack(src, env, filename), imports)
}
