var {
  isDefined, isSymbol, isArray, isNull, isBoolean, isString,
  isDef, isEmpty, isFunction, isNumber, isBound, isBasic,
  eqSymbol, equals, stringify
} = require('./util')
var syms = require('./symbols')

function lookup (key, env) {
  if(isArray(env))
    for(var i = env.length-1; i >= 0; i--)
      if(env[i][0].description === key.description) return env[i][1]

  return env[key.description]
}

var core = {
  if: true, fun: true, def: true, loop: true, block: true
}

function bind(ast, env) {
  var value

  if(isSymbol(ast) && isDefined(value = lookup(ast, env))) {
    if(isFunction(value))
      return ast
    else
      return value
  }
  else if(isBasic(ast)) return ast
  else if(isArray(ast) && ast[0] === syms.fun)
    return ast
  else if(isArray(ast) && ast[0] === syms.get) {
    if(ast.length == 1) throw new Error('cannot eval get, no arguments:'+stringify(ast))
    var value = env
    for(var i = 1; i < ast.length; i++) {
      value = lookup(ast[i], value)
    }
    if(!isDefined(value)) throw new Error('could not resolve:'+stringify(ast))
    return value
  }
  else if(isArray(ast)) {
    if(core[ast[0].description])
      return [ast[0]].concat(ast.slice(1).map(e => bind(e, env)))
    else
      return ast.map(e => bind(e, env))
  }
  else
    return ast
}

function isFun(ast) {
  return isArray(ast) && ast[0] === syms.fun
}

function call (fun, argv, env) {
  if(isSymbol(fun[1]))
    name = fun[1], args = fun[2], body = fun[3]
  else
    name = null, args = fun[1], body = fun[2]

  var _env = {__proto__: env }
  if(argv.length < args.length)
    throw new Error('too few arguments, expected:'+args.length+' got:'+argv.length)
  args.forEach((k, i) => _env[k.description] = ev(argv[i], env))
  if(name) _env[name.description] = fun
  return ev(body, _env)
}


function ev (ast, env) {
  var value
  if('undefined' === typeof ast) throw new Error('ast cannot be undefined')
  if(isBasic(ast))
    return ast
  if(isSymbol(ast)) {
    if(isDefined(value = lookup(ast, env)))
      return value
    else
      throw new Error('undefined symbol:'+ast.description)
  }
  if(ast[0] === syms.def)
    return env[ast[1].description] = ev(ast[2], env)

  if(ast[0] === syms.if)
    if(ev(ast[1], env))
      return ev(ast[2], env)
    else if(ast.length > 2)
      return ev(ast[3], env)
    else
      return null

  if(ast[0] === syms.loop) {
      var test = ast[1]
      var body = ast[2]
      while(ev(test, env)) {
        value = ev(body, env)
      }
      return value
    }


  if(ast[0] === syms.fun) {
    var name, args, body
    if(isSymbol(ast[1]))
      name = ast[1], args = ast[2], body = ast[3]
    else
      name = null, args = ast[1], body = ast[2]

    //1. when evaluating function body, bind free variables including function references.
    //2. any function calls where the arguments are bound can be transparently replaced with return values.
    //3. a closure with free variables that cannot be bound needs to be inlined into functions it's passed to.

    if(isSymbol(name))
      return [syms.fun, name, args, bind(body, env)]
    else {
      return [syms.fun, args, bind(body, env)]
    }
  }

  if(ast[0] === syms.block) {
    for(var i = 1; i < ast.length; i++)
      value = ev(ast[i], env)
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
          exports.push([ast[i][1], ev(ast[i][2], env)])
        }
        else {
          if(single !== null)
            throw new Error('already exported ' (single ? 'single' : 'multiple') + ' cannot export an additional single value')
          single = true
          exports = ev(ast[i][1], env)
        }
      }
      else
        ev(ast[i], env)
    }
    return exports
  }

  //user defined functions
  if(isSymbol(ast[0]) && isFun(value = lookup(ast[0], env)))
    return call(value, ast.slice(1), env)

  //js functions passed in as env.
  if(isSymbol(ast[0]) && isFunction(value = lookup(ast[0], env)))
    return value(ast.slice(1).map(e => ev(e, env)))

  //expression that evaluates to a function
  if(isArray(ast[0])) {
    var fn = ev(ast[0], env)
    return call (fn, ast.slice(1), env)
  }

  throw new Error('could not eval:' +stringify(ast))
}

exports = module.exports = ev
