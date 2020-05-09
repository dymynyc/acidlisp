var syms = require('./symbols')
var {
  isArray, isSymbol, isEmpty, isBoundFun,
  isSystemFun, isFunction, isCore,
  pretty, meta,
} = require('./util')

var lookup = require('./lookup')

function isLookup(sym) {
  return !isCore(sym) && (
    isSymbol(sym) ||
    (isArray(sym) && sym.every(isSymbol) && sym[0] === syms.get)
  )
}

function find(obj, fn) {
  for(var k in obj)
    if(obj[k] === fn) return k
}

function toObj(ary) {
  if(!isArray(ary)) return ary
  var obj = {}
  for(var i = 0; i < ary.length; i++)
    obj[ary[i][0].description] = ary[i][1]
  return obj
}

function unroll (fun, funs, key) {
  funs = funs || {}
  if(fun == null) {
    funs = toObj(funs)
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
  funs[getName()] = fun

  if(isSystemFun(fun)) return funs //system funs don't have a body

  var body = fun[3]
  if(isBoundFun(body)) {
    if(k = find(funs, body)) fun[3] = k
    else                     unroll(body, funs)
    return funs
  }

  var scope = fun[4]
  ;(function R (ast) {
    if(isBoundFun(ast[0])) {
      if(k = find(funs, ast[0])) ast[0] = Symbol(k)
      else {
        unroll(ast[0], funs)
        ast[0] = Symbol(find(funs, ast[0]))
      }
    }
    var sym = ast[0]
    if(isLookup(sym)) {
      console.log("LOOKUP", sym, scope)
      var fn = lookup(scope, sym, false)
      if(isArray(sym))
        ast[0] = Symbol(find(funs, fn))
      if(isSystemFun(fn) || isBoundFun(fn)) {
        if(k = find(funs, fn)) ast[0] = Symbol(k)
        else {
          unroll(fn, funs)
          ast[0] = Symbol(find(funs, fn))
        }
      }
      else if(isFunction(fn)) {
        if(isArray(sym)) throw new Error('referred to a built-in via path name:'+pretty(sym))
        //it's a built in, so ignore it. the compiler knows what to do.
        ;
      }
      else
        //should never happen
        throw new Error('lookup failed:'+pretty(sym))
    }
    for(var i = 1; i < ast.length; i++)
      if(isArray(ast[i])) R(ast[i])
  })(body)

  return funs
}

function checkUnbound (fn, _scope) {
  var unbound = {}
  var scope = {__proto__: scope}
  if(isSymbol(fn[1])) scope[fn[1]] = true //check if the function has a name

  fn[2].forEach(function (k) {
    if(!isSymbol(k)) throw new Error('function arg was not symbol')
    scope[k.description] = true
  })

  ;(function R (ast) {
    if(!isArray(ast)) throw new Error('should be array')
    if(ast[0] === syms.def) {
      scope[ast[1].description] = true
      R(ast.slice(2)) //check the value
    }
    for(var i = 0; i < ast.length; i++) {
      var v = ast[i]
      if(isSymbol(v)) {
        var name = v.description
        if(v !== syms[name] && !scope[name])
          unbound[name] = true
      }
      if(isArray(v)) R(v)
    }
  })(fn[3])
  return isEmpty(unbound) ? null : unbound
}

function unbind (fun, k) {
  if(isSystemFun(fun)) return meta(fun, [fun[0], k, fun[2], fun[3]])

  if(fun[1]) //named
    return meta(fun, [syms.fun, fun[1], fun[2], fun[3]])
  else if(k)
    //TODO if the function is recursive, replace internal name for itself.
    //this is necessary for inline functions.
    return meta(fun, [syms.fun, k, fun[2], fun[3]])
  else
    throw new Error('function key not provided')
}

function assertUnbound(funs) {
  for(var k in funs) {
    var fn = funs[k]
    var v = checkUnbound(fn)
    if(v) throw new Error('found unbound variables:'+Object.keys(v).join(', ') + ' in fun:'+(fn[1]||k))
  }

}

module.exports = function (funs) {
  if(isBoundFun(funs)) {
    var fun = funs
    funs = unroll(fun, {})
    //assertUnbound(funs)
    return [syms.module]
      .concat(
        Object.keys(funs).reverse()
        .map(k=>[syms.def, Symbol(k), unbind(funs[k], Symbol(k))]))
      .concat([[syms.export, Symbol(find(funs, fun))]])
  }
  else {
    funs = toObj(funs)
    var initial = {}
    for(var k in funs)
      initial[k] = funs[k]
    funs = unroll(null, funs)
    //assertUnbound(funs)
    return [syms.module]
      .concat(
        Object.keys(funs).reverse()
        .map(k=>[syms.def, Symbol(k), unbind(funs[k], Symbol(k))])
      )
      .concat(
        Object.keys(initial)
        .map(k=>[syms.export, k=Symbol(k), k])
      )
  }
}
