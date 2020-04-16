var {
  isFun, isSymbol, parseFun, toEnv
} = require('./util')

var ev = require('./eval')
var syms = require('./symbols')

function wrapFn (fun, env) {
  return function () {
    return ev.call(fun, [].slice.call(arguments), env)
  }
}

exports = module.exports = function (tree, env) {
  if(isFun(tree))
    return wrapFn(tree, env)
  var o = {}
  tree.forEach(pair => o[pair[0].description] = wrapFn(pair[1], env))
  return o
}

exports.wrapFn   = wrapFn
