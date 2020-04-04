var {
  isDefined, isSymbol, isArray,
  isDef, isEmpty, isFunction, isNumber, isBound,
  eqSymbol, equals
} = require('./util')


//when defining a function, insert any scoped variables.
function bind(ast, env) {
  if(isArray(ast) && isSymbol(ast[0]) && ast[0].description == 'ref') return ast
  if(isSymbol(ast) && env[ast.description]) {
    return [Symbol('ref'), env[ast.description], ast]
  }
  if(!isArray(ast)) return ast
  else if(isEmpty(ast)) return []
  else {
    //if we know everything to call this value, just return it now
    ast = ast.map(a => bind(a, env))
    if(ast.every(isBound) && isFunction(ast[0][1])) {
      return expand(ast, env)
    }
    return ast
//    if(!eqSymbol(ast[0], 'ref') && ast.every(isBound)) {
//      return expand(ast, env)
//    }
//    return ast
  }
}

function fun (_args, env) {
  var name
  if(isSymbol(_args[0])) name = _args.shift()
  var args = _args.shift()
  var body = _args

  function fn (argv, env) {
    var _env = {}
    _env.__proto__ = env
    args.forEach((k, i) => _env[k.description] = argv[i])
    for(var i = 0; i + 1 < body.length; i += 2) {
      if(equals(argv, body[i])) return expand(body[i+1], env)
    }
    return expand(body[i], _env)
  }
  body = bind(body, name ? {__proto__: env, [name.description]: fn} : env)
  fn.source = [Symbol('fun')].concat(name ? [name] : []).concat([args]).concat(body)

  return fn
}

function get (args, env) {
  var object = args[0]
  for(var i = 1; i < args.length; i++)
    object = object[args[i].description]
  return object
}

function ref (args) {
  return args[1]
}

function expand (ast, env) {
  if(isEmpty(ast)) return ast
  if(isSymbol(ast)) {
    if(isDefined(env[ast.description])) return env[ast.description]
    return ast
  }
  else if(!isArray(ast))
    return ast
  else if(isFunction(ast[0]))
    return ast[0](ast.slice(1).map(e => expand(e, env)), env)
  else if(isArray(ast[0])) {
    var fn = expand(ast[0], env)
    return fn(ast.slice(1).map(e => expand(e, env)), env)
  }
  else if(isSymbol(ast[0]) && 'ref' === ast[0].description)
    return ast[1]
  else if(isSymbol(ast[0]) && 'fun' === ast[0].description)
    return fun([ast[1]].concat(ast.slice(2)), env)
  else if(isDef(ast[0])) {
    return [Symbol('def'), ast[1], env[ast[1].description] = expand(ast[2], env)]
  }
  else if(env[ast[0].description]) {
    return env[ast[0].description](ast.slice(1).map(e => expand(e, env)), env)
  }
  else //if it isn't a defined function, just replace names and fall through.
    return ast.map(e => expand(e, env)).filter(isDefined)
}

module.exports = expand
