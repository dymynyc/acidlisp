var {
  isDefined, isSymbol, isArray, isNull, isBoolean, isString,
  isDef, isEmpty, isFunction, isNumber, isBound, isBasic,
  eqSymbol, equals, stringify
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

var core = {
  if: true, fun: true, def: true
}
function bind(ast, env) {
  var value
  if(isSymbol(ast) && isDefined(value = lookup(env, ast)))
    return value
  else if(isBasic(ast)) return ast
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
  return isArray(ast) && eqSymbol(ast[0], 'fun')
}

function call (fun, argv, env) {
  if(isSymbol(fun[1]))
    name = fun[1], args = fun[2], body = fun[3]
  else
    name = null, args = fun[1], body = fun[2]

  var _env = {__proto__: env }
  args.forEach((k, i) => _env[k.description] = ev(argv[i], env))
  if(name) _env[name.description] = fun
  return ev(body, _env)
}


function ev (ast, env) {
  var value
  if(isBasic(ast))
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

  if(isArray(ast) && eqSymbol(ast[0], 'loop')) {
      var test = ast[1]
      var body = ast[2]
      while(ev(test, env)) {
        value = ev(body, env)
      }
      return value
    }

  if(isArray(ast) && eqSymbol(ast[0], 'fun')) {
    var name, args, body
    if(isSymbol(ast[1]))
      name = ast[1], args = ast[2], body = ast[3]
    else
      name = null, args = ast[1], body = ast[2]

    //1. when evaluating function body, bind free variables including function references.
    //2. any function calls where the arguments are bound can be transparently replaced with return values.
    //3. a closure with free variables that cannot be bound needs to be inlined into functions it's passed to.

    //prehaps a better approach is to have separate variables and constants?
    //constants can't be re assigned, vars can. so constants can be inlined.
    //and make arguments be constants by default. can always assign a var to that value.

    /*
      return function (offset) {
        map(array, function (item) { offset+item })
      }
    */

    //I want a language where everything is an expression
    //but have to compile to wasm where if and loops are statements.
    /*
        if <loop> then <a> else <b>

      becomes:

        <loop (sets value1)>
        if(value) then <sets value2> else <sets value2>

      if(foo) then value = bar else value = baz
      if(value) qux
    */
    return bind(ast, env)
  }

  if(isArray(ast) && eqSymbol(ast[0], 'block')) {
    for(var i = 1; i < ast.length; i++)
      value = ev(ast[i], env)
    return value
  }

  //user defined functions
  if(isArray(ast) && isSymbol(ast[0]) && isFun(value = lookup(ast[0], env)))
    return call(value, ast.slice(1), env)

  //built in functions
  if(isArray(ast) && isSymbol(ast[0]) && isFunction(value = lookup(ast[0], env)))
    return value(ast.slice(1).map(e => ev(e, env)))

  //expression that evaluates to a function
  if(isArray(ast) && isArray(ast[0])) {
    var fn = ev(ast[0], env)
    return call (fn, ast.slice(1), env)
  }

  throw new Error('could not eval:' +stringify(ast))
}

exports = module.exports = ev
