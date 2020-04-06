var {
  isDefined, isSymbol, isArray, isNull, isBoolean, isString,
  isDef, isEmpty, isFunction, isNumber, isBound,
  eqSymbol, equals
} = require('./util')

function lookup (key, env) {
  return env[key.description]
}

//function map_args (name, args, argv, _env) {
//  var env = {__proto__: env }
//  if(name) env[name.description] = fun
//  args.forEach((k, i) => _env[k.description] = argv[i])
//
//}
//
function ev (ast, env) {
  var value
  if(isNumber(ast) || isNull(ast) || isBoolean(ast) || isString(ast))
    return ast
  if(isSymbol(ast) && isDefined(value = lookup(ast, env)))
    return value
  if(isArray(ast) && isDef(ast[0]))
    return env[ast[1].description] = ev(ast[2], env)

  if(isArray(ast) && eqSymbol(ast[0], 'if'))
    if(ev(ast[1], env))
      return ev(ast[2], env)
    else if(ast.length > 2)
      return ev(ast[3], env)
    else
      return null

  if(isArray(ast) && eqSymbol(ast[0], 'fun')) {
    var name, args, body
    if(isSymbol(ast[1]))
      name = ast[1], args = ast[2], body = ast[3]
    else
      name = null, args = ast[1], body = ast[2]

    function fun (argv) {
      var _env = {__proto__: env }
      if(name) _env[name.description] = fun
      args.forEach((k, i) => _env[k.description] = argv[i])
      return ev(body, _env)
    }

    fun.source = ast
    return fun
  }

  if(isArray(ast) && eqSymbol(ast[0], 'block')) {
    for(var i = 1; i < ast.length; i++)
      value = ev(ast[i], env)
    return value
  }


  if(isArray(ast) && isSymbol(ast[0]) && isFunction(value = lookup(ast[0], env)))
    return value(ast.slice(1).map(e => ev(e, env)))

  if(isArray(ast) && isArray(ast[0])) {
    var fn = ev(ast[0], env)
    return fn(ast.slice(1), env)
  }
}

exports = module.exports = ev
