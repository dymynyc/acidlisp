
function isDefined(d) {
  return 'undefined' !== typeof d
}

function isSymbol(s) {
  return 'symbol' === typeof s
}

var isArray = Array.isArray

function isDef(s) {
  return isSymbol(s) && 'def' === s.description
}

function isEmpty (e) {
  return isArray(e) && e.length === 0
}

function isFunction (f) {
  return 'function' === typeof f
}

//(def (name args...) (body))
function equals (a, b) {
  if(isArray(a) && isArray(b))
    return (a.length === b.length) && a.every((v, i) => equals(v, b[i]))
  return a === b
}

//when defining a function, insert any scoped variables.
function bind(ast, env) {
  if(isSymbol(ast) && env[ast.description]) return env[ast.description]
  if(!isArray(ast)) return ast
  else if(isEmpty(ast)) return []
  else return ast.map(a => bind(a, env))
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
  body = bind(body, name ? {__proto__: env, [name]: fn} : env)
  return fn
}

function get (args, env) {
  var object = args[0]
  for(var i = 1; i < args.length; i++)
    object = object[args[i].description]
  return object
}

function expand (ast, env) {
  if(isEmpty(ast)) return ast
  if(isSymbol(ast)) {
    if(isDefined(env[ast.description])) return env[ast.description]
    return ast
  }
  else if(!isArray(ast))
    return ast
    //console.log('expand ary', ast)
  if(isFunction(ast[0]))
    return ast[0](ast.slice(1).map(e => expand(e, env)), env)
  if(isSymbol(ast[0]) && 'fun' === ast[0].description)
    return fun([ast[1]].concat(ast.slice(2)), env)
  else if(isDef(ast[0])) {
    env[ast[1].description] = expand(ast[2], env)
      //expand(createFunction(ast[1][0], ast[1].slice(1), ast.slice(2))
  }
  else if(env[ast[0].description]) {
    return env[ast[0].description](ast.slice(1).map(e => expand(e, env)), env)
  }
  else //if it isn't a defined function, just replace names and fall through.
    return ast.map(e => expand(e, env)).filter(isDefined)
}

module.exports = expand
