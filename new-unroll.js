var {isBoundFun} = require('./new-eval')
var syms = require('./symbols')
var {isArray, isSymbol} = require('./util')
function find(obj, fn) {
  for(var k in obj)
    if(obj[k] === fn) return k
}

function unroll (fun, funs, key) {
  funs = funs || {}
  if(fun == null) {
    for(var k in funs)
      unroll(funs[k], funs, k)
    return funs
  }
  function getName () {
    return (
      key ? key
    : isSymbol(fun[1]) ? fun[1].description
    : 'fun__' + Object.keys(funs).length
    )
  }
  funs[getName()]= fun

  var body = fun[3]
  if(isBoundFun(body)) {
    if(k = find(funs, body)) fun[3] = k
    else                     unroll(body, funs)
    return funs
  }

  var scope = fun[4]
  ;(function R (ast) {
    if(isBoundFun(ast[0])) {
      if(k = find(funs, ast[0])) ast[0] = k
      else {
        unroll(ast[0], funs)
        ast[0] = Symbol(find(funs, ast[0]))
      }
    }
    var fn
    if(isSymbol(ast[0]) && isBoundFun(fn = scope[ast[0].description])) {
      if(!find(funs, fn))
        unroll(fn, funs, ast[0].description)
    }

    for(var i = 1; i < ast.length; i++)
      if(isArray(ast[i])) R(ast[i])
  })(body)

  return funs
}

function unbind (fun) {
  if(fun[1]) //named
    return [syms.fun, fun[1], fun[2], fun[3]]
  else //anon
    return [syms.fun, fun[2], fun[3]]

}

module.exports = function (funs) {
  if(isBoundFun(funs)) {
    var fun = funs
    funs = unroll(fun, {})
    console.log(funs)
    return [syms.module]
      .concat(
        Object.keys(funs)
        .filter(k=> funs[k] !== fun)
        .map(k=>[syms.def, Symbol(k), unbind(funs[k])]))
      .concat([[syms.export, unbind(fun)]])
  }

}
