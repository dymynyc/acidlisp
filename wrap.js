var {
  isFun, isSymbol, parseFun, toEnv
} = require('./util')

var ev = require('./eval')
var syms = require('./symbols')

//we have a separate call function defined here,
//because we are calling _from_ javascript land
//where the arguments are already evaluated.
//function call (fun, argv, _env) {
//  var {name, args, body} = parseFun(fun)
//  return ev(body, toEnv(args, argv, _env))
//}

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
