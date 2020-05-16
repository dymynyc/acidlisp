var syms = require('./symbols')
var {
  isArray, isSymbol, isEmpty, isBoundFun, isFun, parseFun,
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

var { bound_fun }  = require('./internal')

function bind_fun (fun, scope) {
  var {name,args,body} = parseFun(fun)
  return meta(fun, [bound_fun, name, args, body, scope])
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

  //handle if the function body is it self a bound function.
  var body = fun[3]
  if(isBoundFun(body)) {
    if(k = find(funs, body)) fun[3] = k
    else                     unroll(body, funs)
    return funs
  }

  var scope = {__proto__: fun[4]}
  var args = fun[2]
  for(var i = 0; i < args.length; i++) {
    scope[args[i].description] = {value: null, hasValue: false, arg: true}
  }
  if(fun[1])
    scope[fun[1].description] = {value: fun, hasValue: true, self: true}
  ;(function R (ast) {
    if(isFun(ast[0])) {
      //XXX note: this function cannot access vars in the immediate
      //enclosing scope. TODO
      ast[0] = meta(ast[0], bind_fun(ast[0], scope))
    }
    var sym = ast[0]

    if(isBoundFun(ast[0])) {
      if(k = find(funs, ast[0])) ast[0] = Symbol(k)
      else {
        unroll(ast[0], funs)
        ast[0] = Symbol(find(funs, ast[0]))
      }
    }

    if(isLookup(sym)) {
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
    if(isSymbol(ast[0]) && ast[0] === syms.def) {
      //keep track of local variables, but don't replace them
      //(maybe later?)
      scope[ast[1].description] = {value:null, hasValue: false}
      R(ast[2])
      return
    }

    for(var i = 1; i < ast.length; i++) {
      if(isArray(ast[i])) R(ast[i])
      else if(isSymbol(ast[i])) {
        var _value = lookup(scope, ast[i], false, true)
        //XXX instead make these into global defs.
        //let the inliner handle them.
        if(_value.hasValue !== false) ast[i] = _value.value
      }
    }
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
