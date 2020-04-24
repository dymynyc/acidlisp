//keep a counter when making hygene symbols,
//so that they are always guaranted unique.
var counter = 0
var syms = require('./symbols')
var boundf = Symbol('bound_fun')
var boundm = Symbol('bound_mac')
var errors = require('./errors')
var wrap   = errors.wrap
var {
  isSymbol, isFun, isBasic, isFunction, isArray, isObject, isNumber,
  isMac, isDefined, parseFun,pretty,
  stringify, meta, dump
} = require('./util')

function isBoundMac (m) {
  return isArray(m) && boundm === m[0]
}
function isBoundFun (f) {
  return isArray(f) && boundf === f[0]
}
function isCore (c) {
  return syms[c.description] === c
}

function map(ary, fn, scope, skip) {
  var r = []
  skip = skip || []
  for(var i = 0; i < skip.length; i++)
    r.push(skip[i])

  for(var i  = skip.length; i < ary.length; i++)
    r.push(fn(ary[i], scope))

  return meta(ary, r)
}

//inline scoped vars, but don't overwrite arguments
//or locally defined vars
var rebind = wrap(function (fn, scope) {
  scope = {__proto__: scope}
  function _rebind (ast) {
    if(
      isSymbol(ast) && !isCore(ast) &&
      isBasic(value = lookup(scope, ast, false))
    )
      return value
    else if(isArray(ast)) {
      if(ast[0] === syms.def) {
        scope[ast[1].description] = ast[1]
        return map(ast, _rebind, null, [ast[0], ast[1]])
      }
      return map(ast, _rebind)
    }
    else
      return ast
  }
  var args = fn[2]
  for(var i = 0; i < args.length; i++)
    scope[args[i].description] = args[i]

  return meta(fn, [fn[0], fn[1], fn[2], _rebind(fn[3]), fn[4]])
}, false)

function find (ary, iter) {
  var value
  for(var i = 0; i < ary.length; i++)
    if(isDefined(value = iter(ary[i])))
      return value
}

function lookup(scope, sym, doThrow) {
  if(isArray(sym)) {
    var value = scope
    for(var i = 0; i < sym.length; i++) {
      if(isArray(value)) {
        value = find(value, ([k,v]) => {
          if(k.description === sym[i].description)
            return v
        })
      }
      else if(isObject(value))
        value = value[sym[i].description]
      else if(doThrow !== false)
        throw new Error('could not resolve:'+String(sym[i]))
      else
        return undefined
    }
    return value
  }
  if(!isSymbol(sym))
    throw new Error('cannot lookup non-symbol:'+sym)
  if(!isDefined(scope[sym.description])) {
    if(doThrow !== false)
      throw new Error('cannot resolve symbol:'+String(sym))
    return undefined
  }
  return scope[sym.description]
}

var bind = wrap(_bind, false)

function _bind (body, scope) {
  var r = __bind(body, scope)
  if(isArray(r)) r.meta = body.meta
  return r
}

function isLookup(value) {
  return (isArray(value) && value[0] === syms.get)
}


function __bind (body, scope) {
  var value
  if(Array.isArray(body)) {
    errors.checkArity(body)
    if(body[0] === syms.get)
      return lookup(scope, body.slice(1))
    if(body[0] === syms.mac)
      return bind_mac(body, scope)
    if(body[0] === syms.fun)
      return bind_fun(body, scope)
    else  if(body[0] === syms.quote)
      return quote(body, scope)
    else if(body[0] === syms.unquote)
      return ev(body[1], scope)

    if(isSymbol(body[0]) && !syms[body[0].description] && isBoundMac(value = lookup(scope, body[0], false))) {
      return bind(call(value, body.slice(1).map(e => bind(e, scope)), scope), scope)
    }

    // allow if a bound mac is just returned inline
    var bm = isBoundMac(body[0]) ? body[0] : bind(body[0], scope)
    if(isBoundMac(bm)) {
      return bind(call(bm, body.slice(1).map(e => bind(e, scope))), scope)
    }
    else {
      if(isLookup(body[0])) {
          bm = lookup(scope, body[0].slice(1))
        if(!bm) throw new Error('could not resolve:'+pretty(body[0]))
      }
      var r = [bm || body[0]].concat(body.slice(1).map(b => bind(b, scope)))
      r.meta = body.meta
      return r
    }
  }
  else if(isSymbol(body) && isBasic(value = lookup(scope, body, false)))
    return value
  return body
}

function bind_fun (fun, scope) {
  var {name,args,body} = parseFun(fun)
  return meta(fun, [boundf, name, args, bind(body, scope), scope])
}

function bind_mac (mac, scope) {
  var {name,args,body} = parseFun(mac)
  return meta(mac, [boundm, name, args, body, scope])
}

var call = wrap(_call, true)

function _call (fn, argv, callingScope) {
  if(isFunction(fn)) {
    return fn.apply(null, argv)
  }
  if(fn[0] !== boundf && fn[0] !== boundm) throw new Error('expected bound function:' + stringify(fn))
  var scope = {__proto__: fn[4]}
  var args = fn[2], body = fn[3]
  if(!isArray(args))
    throw new Error('args was wrong:' + stringify([name, args, body]))
  for(var i = 0; i < args.length; i++)
    scope[args[i].description] = argv[i]
  if(fn[1])
    scope[fn[1].description] = fn

  if(isBoundMac(fn)) {
    var r = ev(body, scope)
    //aha! because r is evaluated in the same scope it was called
    //in it can continue calling itself
    try {
      return bind(r, scope)
    }
    catch(err) {
      console.error('problem binding', dump(callingScope))
      throw err
    }
  }
  else
    return ev(body, scope)
}


var ev = wrap(_ev, false)

function _ev(ast, scope) {
  var value, env = scope
  //if we encounter a inline function, bind that are in scope.

  if(isBoundFun(ast)) return rebind(ast, scope)
  if(isBoundMac(ast)) return rebind(ast, scope)
  if(isFun(ast))      return bind_fun(ast, scope)
  if(isMac(ast))      return bind_mac(ast, scope)

  if(Array.isArray(ast)) {
    var symbol = ast[0]
    if(ast[0] === syms.block) {
      for(var i = 1; i < ast.length; i++)
        value = ev(ast[i], scope)
      return value
    }
    //modules test doesn't use this yet...
    if(ast[0] === syms.get) {
      return lookup(scope, ast.slice(1))
    }
    if(ast[0] === syms.def) {
      if(!isSymbol(ast[1])) throw new Error('attempted to define a non-symbol:'+stringify(ast))
      return scope[ast[1].description] = ev(ast[2], scope)
    }
    if(ast[0] === syms.set) {
      if(!isSymbol(ast[1])) throw new Error('attempted to define a non-symbol:'+stringify(ast))
      //note: this means you can't set values in the outer closure.
      //but you can call functions?
      if(!isDefined(scope[ast[1].description]))
        throw new Error('attempted to set unknown var')
      return scope[ast[1].description] = ev(ast[2], scope)
    }
    if(ast[0] === syms.quote)
      return quote(ast[1], scope)
    if(ast[0] === syms.unquote)
      return ev(ast[1], scope)

    if(ast[0] === syms.list)
      return ast.slice(1).map(v => ev(v, scope))

    if(ast[0] === syms.if) {
      if(ev(ast[1], scope))
        return ev(ast[2], scope)
      else if(ast.length > 2)
        return ev(ast[3], scope)
    }

    else if(ast[0] === syms.and) {
      var value
      for(var i = 1;i < ast.length; i++)
        if(!(value = ev(ast[i], scope)))
          return 0
        return value
    }
    else if(ast[0] === syms.or) {
      var value
      for(var i = 1;i < ast.length; i++)
        if(value = ev(ast[i], scope))
          return value
      return 0
    }

    if(symbol === syms.loop) {
        var test = ast[1]
        var body = ast[2]
        value = 0
        while(ev(test, env)) {
          value = ev(body, env)
        }
        return value
      }

    //XXX here, export is only allowed at the top level?
    // should export be allowed inside if?
    // I guess you can put an def in the if and export the reference.
    if(ast[0] === syms.module) {
      var exports = [], single = null
      for(var i = 1; i < ast.length; i++) {
        if(isArray(ast[i]) && ast[i][0] === syms.export) {
          if(isSymbol(ast[i][1]) && ast[i].length == 3) {
            if(single === true)
              throw new Error('already exported a single symbol, cannot export multiple')
            single = false
            exports.push([ast[i][1], ev(ast[i][2], scope)])
          }
          else {
            if(single !== null)
              throw new Error('already exported ' + (single ? 'single' : 'multiple') + ' cannot export an additional single value:'+stringify(ast))
            single = true
            exports = ev(ast[i][1], scope)
          }
        }
        else
          ev(ast[i], scope)
      }
      exports.meta = {}
      return exports
    }

    if(isBoundFun(ast[0]) || isFunction(ast[0]) || isBoundMac(ast[0]))
      bf = ast[0]
    else {
      bf = ev(ast[0], scope)
    }
    if(isBoundMac(bf)) //XXX
      return ev(bind(call(bf, ast.slice(1).map(e => bind(e, scope)), scope), scope), scope)

    if(false && isFunction(bf)) {
      var args = ast.slice(1).map(v => ev(v, scope))
      try {
        return bf.apply(null, args)
      } catch (err) {
        if(err.acid) throw err
        throw errors.addAcidStackTrace(ast, err)
      }
    }
    if(isBoundFun(bf) || isFunction(bf)) {
      try {
        return call(bf, ast.slice(1).map(v => ev(v, scope)))
      } catch (err) {
        if(err.acid) throw err
        throw errors.addAcidStackTrace(ast, err)
      }
    }
    throw new Error('expected function:'+stringify(ast))
  }
  else if(isBasic(ast))  return ast
  else if(isSymbol(ast)) return lookup(scope, ast)
  else throw new Error('not supported yet:'+stringify(ast))
}

function quote (ast, scope) {
  if(!scope) throw new Error('scope missing')
  if(isArray(ast)) {
    if(ast[0] === syms.unquote) {
      return meta(ast, ev(ast[1], scope))
    }
    else if(ast[0] === syms.quote)
      return ast
    //note; they could do (quote (def (unquote sym)))
    //to define a symbol passed in from caller.
    if(ast[0] === syms.def && isSymbol(ast[1])) {
      if(!scope.__hygene) scope.__hygene = {}
      var newSym = Symbol(ast[1].description + '__' + (++counter))
      scope.__hygene[ast[1].description] = newSym
      //made this mistake several times: after doing the map,
      //didn't traverse into the last arg!
      return meta(ast[0], [ast[0], newSym, quote(ast[2], scope)])
    }
    return meta(ast, ast.map(v => quote (v, scope)))
  }
  else if(isSymbol(ast) && scope.__hygene)
    return scope.__hygene[ast.description] || ast
  return ast
}
exports = module.exports = ev
exports.call = function (fun, args) {
  return call(fun, args)
}
exports.eval = ev
exports.quote = quote
exports.bind = bind
exports.isBoundMac = isBoundMac
exports.isBoundFun = isBoundFun
