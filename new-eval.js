//keep a counter when making hygene symbols,
//so that they are always guaranted unique.
var counter = 0
var syms = require('./symbols')
var boundf = Symbol('bound_fun')
var boundm = Symbol('bound_mac')
var {
  isSymbol, isFun, isBasic, isFunction, isArray,
  isMac, isDefined, parseFun,
  stringify
} = require('./util')

function isBoundMac (m) {
  return isArray(m) && boundm === m[0]
}
function isBoundFun (f) {
  return isArray(f) && boundf === f[0]
}

function bind (body, scope) {
  if(Array.isArray(body)) {
    if(body[0] === syms.mac)
      return bind_mac(body, scope)
    if(body[0] === syms.fun)
      return bind_fun(body, scope)
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
  var {name,args,body} = parseFun(fun)
  return [boundf, name, args, bind(body, scope), scope]
}

function bind_mac (mac, scope) {
  var {name,args,body} = parseFun(mac)
  return [boundm, name, args, body, scope]
}

function lookup(scope, sym) {
  if(!isDefined(scope[sym.description]))
    throw new Error('cannot resolve symbol:'+String(sym))
  return scope[sym.description]
}

function call (fn, argv) {
  if(isFunction(fn))
    return fn.apply(null, argv)

  if(fn[0] !== boundf && fn[0] !== boundm) throw new Error('expected bound function:' + stringify(fn))
  var scope = {__proto__: fn[4]}
  var args = fn[2], body = fn[3]
  if(!isArray(args))
    throw new Error('args was wrong:' + stringify([name, args, body]))
  for(var i = 0; i < args.length; i++)
    scope[args[i].description] = argv[i]
  return ev(body, scope)
}

function ev(ast, scope) {
  var value
  if(isFun(ast)) {
    return bind_fun(ast, scope)
  }
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
      //note: this means you can't set values in the outer closure.
      //but you can call functions?
      if(!isDefined(scope[ast[1].description]))
        throw new Error('attempted to set unknown var')
      return scope[ast[1].description] = ev(ast[2], scope)
    }
    if(ast[0] === syms.quote)
      return quote(ast[1], scope)

    if(ast[0] === syms.list)
      return ast.slice(1).map(v => ev(v, scope))

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
          ev(ast[i], env)
      }
      return exports
    }

    if(isBoundFun(ast[0]) || isFunction(ast[0]) || isBoundMac(ast[0]))
      bf = ast[0]
    else
      bf = ev(ast[0], scope)

    if(isBoundMac(bf))
      return ev(call(bf, ast.slice(1)), scope)
    if(isBoundFun(bf) || isFunction(bf))
      return call(bf, ast.slice(1).map(v => ev(v, scope)))

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
  else if(isSymbol(ast) && scope.__hygene)
    return scope.__hygene[ast.description] || ast

  return ast
}
exports = module.exports = ev
exports.eval = ev
exports.quote = quote
exports.bind = bind
exports.isBoundMac = isBoundMac
exports.isBoundFun = isBoundFun
