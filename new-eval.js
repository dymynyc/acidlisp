//keep a counter when making hygene symbols,
//so that they are always guaranted unique.
var counter = 0
var syms = require('./symbols')
var boundf = Symbol('bound_fun')
var boundm = Symbol('bound_mac')
var {
  isSymbol, isFun, isBasic, isFunction, isArray,
  isMac,
  stringify
} = require('./util')

function isBoundMac (m) {
  return isArray(m) && boundm === m[0]
}

function keys (map) {
  var a = []
  var it = map.keys()
  while(!(v = it.next()).done)
    a.push(v.value)
  return a
}

function toObj(map) {
  if(!(map instanceof Map)) return map
  var obj = {}
  if(map.parent) obj.__proto__ = toObj(map.parent)

  var it = map.entries()
  while(!(v = it.next()).done)
    obj[v.value[0].description] = v.value[1]
  return obj
}

function bind (body, scope) {
  scope = toObj(scope)
  if(Array.isArray(body)) {
    if(body[0] === syms.mac)
      return bind_mac(body, scope)
    else  if(body[0] === syms.quote)
      return quote(body, scope)
    else if(body[0] === syms.unquote) {
      return ev(body[1], scope)
    }

    if(isSymbol(body[0]) && !syms[body[0].description] && isBoundMac(value = lookup(scope, body[0]))) {
      return call(value, body.slice(1))
    }

    var bm = bind(body[0], scope)
    if(isBoundMac(bm))
      return call(bm, body.slice(1))
    else
      return [bm].concat(body.slice(1).map(b => bind(b, scope)))
  }
  return body
}

function bind_fun (fun, scope) {
  scope = toObj(scope)
  if(isSymbol(fun[1]))
    name = fun[1], args = fun[2], body = fun[3]
  else
    name = null, args = fun[1], body = fun[2]
  console.log('bind body?', body)
  return [boundf, name, args, bind(body, scope), scope]
}

function bind_mac (mac, scope) {
  scope = toObj(scope)
  if(mac.length < 3 || mac.length > 4) {
    console.log(mac)
    throw new Error('incorrect length of mac expression:'+stringify(mac))
  }
  if(isSymbol(mac[1]))
    name = mac[1], args = mac[2], body = mac[3]
  else
    name = null, args = mac[1], body = mac[2]
  //if we bound the body of the macro, it would expand quote.
  return [boundm, name, args, body, scope]
}

function lookup(scope, sym) {
  scope = toObj(scope)
  if(!(scope instanceof Map))
    return scope[sym.description]
  if(scope.has(sym)) {
    return scope.get(sym)
  }
  else if(scope.parent)
    return lookup(scope.parent, sym)
  else
    throw new Error('cannot resolve symbol:'+String(sym))
}

function call (fn, argv) {
  if(isFunction(fn))
    return fn.apply(null, argv)

  if(fn[0] !== boundf && fn[0] !== boundm) throw new Error('expected bound function:' + stringify(fn))
  var scope = new Map()
  scope.parent = fn[4]
  var args = fn[2], body = fn[3]
  if(!isArray(args))
    throw new Error('args was wrong:' + stringify([name, args, body]))
  for(var i = 0; i < args.length; i++)
    scope.set(args[i], argv[i])

  scope = toObj(scope)
  return ev(body, scope)
}

function ev(ast, scope) {
  scope = toObj(scope)
  var value
  if(isFun(ast))
    return bind_fun(ast, scope)
  if(isMac(ast))
    return bind_mac(ast, scope)

  if(Array.isArray(ast)) {
    if(ast[0] === syms.block) {
      for(var i = 1; i < ast.length; i++)
        value = ev(ast[i], scope)
      return value
    }
    if(ast[0] === syms.def) {
      if(!isSymbol(ast[1])) throw new Error('attempted to define a non-symbol:'+stringify(ast))
      return scope[ast[1].description] = ev(ast[2], scope)
    }
    if(ast[0] === syms.set) {
      if(!isSymbol(ast[1])) throw new Error('attempted to define a non-symbol:'+stringify(ast))
      if(!scope.hasOwnProperty(ast[1].description)) throw new Error('attempted to set unknown var')
      console.log('SET', ast, scope)
      return scope[ast[1].description] = ev(ast[2], scope)
    }
    if(ast[0] === syms.quote)
      return quote(ast[1], scope)

    if(ast[0] === syms.list)
      return ast.slice(1).map(v => ev(v, scope))

    var bf = ev(ast[0], scope)
    if(isBoundMac(bf)) {
      value = call(bf, ast.slice(1))
      console.log('macout', value)
      return ev(value, scope)
    }

    if(!bf)
      throw new Error('expected function:'+stringify(ast))

    return call(bf, ast.slice(1).map(v => ev(v, scope)))
  }
  else if(isBasic(ast))
    return ast
  else if(isSymbol(ast)) //variable!
    return lookup(scope, ast)
  else
    throw new Error('not supported yet:'+stringify(ast))
}

function quote (ast, scope) {
  if(!scope) throw new Error('scope missing')
  if(isArray(ast)) {
    if(ast[0] === syms.unquote) {
      return ev(ast[1], scope)
    }
    //note; they could do (quote (def (unquote sym)))
    //to define a symbol passed in from caller.
    if(ast[0] === syms.def && isSymbol(ast[1])) {
      if(!scope.__hygene) scope.__hygene = {}
      var newSym = Symbol(ast[1].description + '__' + (++counter))
      scope.__hygene[ast[1].description] = newSym
      return [ast[0], newSym, bind(ast[2], scope)]
    }
    return ast.map(v => quote (v, scope))
  }
  //XXX somethings up!
  else if(isSymbol(ast) && scope.__hygene)
    return scope.__hygene[ast.description] || ast

  return ast
}

exports.eval = ev
exports.quote = quote
exports.bind = bind
