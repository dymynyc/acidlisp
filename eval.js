var syms      = require('./symbols')
var errors    = require('./errors')
var lookup    = require('./lookup')
var wrap   = errors.wrap

var {
  bound_fun: boundf, system_fun
}  = require('./internal')

var {
  isSymbol, isFun, isBasic, isFunction, isArray,
  isObject, isNumber, isCore, isDefined,
  isBoundFun, isSystemFun,
  parseFun, pretty, stringify, meta, dump
} = require('./util')

function bind_fun (fun, scope) {
  var {name,args,body} = parseFun(fun)
  return meta(fun, [boundf, name, args, body, scope])
}

function createScope(fn, map, _scope) {
  var name = fn[1], args = fn[2]
  var scope = {__proto__: _scope || {}}
  for(var i = 0; i < args.length; i++)
    scope[args[i].description] = {value: map(args[i], i)}
  if(name)
    scope[name.description] = {value: fn}
  return scope
}

var call = wrap(function (fn, argv, callingScope) {
  if(isFunction(fn))
    return fn.apply(null, argv)
  if(!isBoundFun(fn) && !isSystemFun(fn))
    throw new Error('expected bound function:' + stringify(fn))

  errors.assertArgs(fn, argv)

  if(isSystemFun(fn))
    return fn[4].system_call(fn[3][0], fn[3][1], argv)

  return ev(fn[3], createScope(fn, (_, i) => argv[i], fn[4]))
}, true)


var ev = wrap(function (ast, scope) {
  var value, env = scope
  //if we encounter a inline function, bind that are in scope.

  if(isBoundFun(ast)) return ast
  if(isFun(ast))      return bind_fun(ast, scope)

  if(Array.isArray(ast)) {
    var symbol = ast[0]
    if(ast[0] === syms.block) {
      for(var i = 1; i < ast.length; i++) value = ev(ast[i], scope)
      return value
    }
    if(ast[0] === syms.scope) {
      scope = {__proto__: scope}
      for(var i = 1; i < ast.length; i++) value = ev(ast[i], scope)
      return value
    }

    if(ast[0] === syms.batch) {
      var args = ast[1], argv = ast[2]
      if(args.length != argv.length)
        throw new Error('batch: number of values must batch vars, got:'+argv.length+', expected:'+args.length)
      var values = argv.map(v => ev(v, scope))
      for(var i = 0; i < args.length; i++)
        value = (scope[args[i].description] = {value: values[i]}).value
      return value
    }

    //modules test doesn't use this yet...
    if(ast[0] === syms.get) {
      return lookup(scope, ast.slice(1))
    }
    if(ast[0] === syms.def) {
      if(!isSymbol(ast[1])) throw new Error('attempted to define a non-symbol:'+stringify(ast))
      return (scope[ast[1].description] = {value: ev(ast[2], scope)}).value
    }
    if(ast[0] === syms.set) {
      if(!isSymbol(ast[1])) throw new Error('attempted to define a non-symbol:'+stringify(ast))
      //note: this means you can't set values in the outer closure.
      //but you can call functions?
      if(!isDefined(scope[ast[1].description]))
        throw new Error('attempted to set unknown var')
      return (scope[ast[1].description].value = ev(ast[2], scope))
    }

    if(ast[0] === syms.list)
      return ast.slice(1).map(v => ev(v, scope))

    if(ast[0] === syms.if)
      return (
          ev(ast[1], scope) ? ev(ast[2], scope)
        : ast.length > 2    ? ev(ast[3], scope)
        :                     0
      )

    else if(ast[0] === syms.and) {
      var value
      for(var i = 1;i < ast.length; i++)
        if(!(value = ev(ast[i], scope))) return 0
        return value
    }
    else if(ast[0] === syms.or) {
      var value
      for(var i = 1;i < ast.length; i++)
        if(value = ev(ast[i], scope)) return value
      return 0
    }

    if(symbol === syms.loop) {
        var test = ast[1], body = ast[2], result = ast[3]
        while(ev(test, env)) ev(body, env)
        return result ? ev(result, env) : 0 //should be nil
      }

    //XXX here, export is only allowed at the top level?
    // should export be allowed inside if?
    // I guess you can put an def in the if and export the reference.
    if(ast[0] === syms.module) {
      var exports = [], single = null
      for(var i = 1; i < ast.length; i++) {
        if(isArray(ast[i])) {
          var ary = ast[i]
          var sym = ary[0]

          if(sym === syms.def && isArray(ary[2]) &&
            ary[2][0] === syms.system) {
            //make the pattern look like a bound function
            var sc = scope[ary[1].description] =
              {value: [system_fun, null, ary[2][3], [ary[2][1], ary[2][2]], scope]}
            sc.meta = ary[2].meta
          }
          else if(sym === syms.export) {
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
        else ev(ast[i], scope)
      }
      exports.meta = ast.meta
      return exports
    }

    if(isBoundFun(ast[0]) || isFunction(ast[0]))
      bf = ast[0]
    else
      bf = ev(ast[0], scope)

    if(isBoundFun(bf) || isFunction(bf) || isSystemFun(bf)) {
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
})

exports = module.exports = ev
exports.call = call
exports.eval = ev
