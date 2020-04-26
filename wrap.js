var {
  isFun, isSymbol, parseFun, toEnv, isBoundFun
} = require('./util')

var ev = require('./eval')
var syms = require('./symbols')

function wrapFn (fun, env) {
  return function () {
    return ev.call(fun, [].slice.call(arguments), env)
  }
}

exports = module.exports = function (tree, env) {
  if(isFun(tree) || isBoundFun(tree)) {
    var fn = wrapFn(tree, env)
    fn.memory = env.memory
    return fn
  }
  var o = {}
  tree.forEach(pair => o[pair[0].description] = wrapFn(pair[1], env))
  o.memory = env.memory
  return o
}

exports.wrapFn   = wrapFn
