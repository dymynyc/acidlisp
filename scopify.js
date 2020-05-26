var {isArray, isSymbol} = require('./util')
var syms = require('./symbols')

function prefix (sym) {
  return /^[^_$0-9]+/.exec(ast.description)[0]
}

function startAt(ast) {
  return isArray(ast[0]) ? 0 : 1
}

function tidy (ast) {
  var vars = {}, prefixes = {}
  function prefix (ast) {
    var str = /^[^_\$0-9]+/.exec(ast.description)[0]
    return Symbol(str + (prefixes[str] = (prefixes[str] || 0) + 1))
  }

  ;(function R (ast) {
    if(isSymbol(ast) && /^[a-zA-Z]+[_\$0-9]+$/.test(ast.description))
      vars[ast.description] = vars[ast.description] || prefix(ast)
    else if(isArray(ast))
      //when we are ready to output wat, vars cannot be functions
      //so start iterating at 1.
      for(var i = startAt(ast); i < ast.length;i ++) R(ast[i])
  })(ast)

  ;(function R (ast) {
    if(isSymbol(ast) && vars[ast.description]) // && /^[a-zA-Z_]+(?:(?:$|__)\d+)+$/.test(ast.description))
      return vars[ast.description] || ast
    else if(isArray(ast))
      for(var i = startAt(ast); i < ast.length;i ++) ast[i] = R(ast[i])
    return ast
  })(ast)

  return ast
}

function batch (ast) {
  var args = ast[1] //.map(function (s) { return s.description })
  var argv = ast[2]
  var _args = {}
  args.forEach(function (s, i) { _args[s.description] = i })
  //this works but kinda want to not create tmp vars
  //unless necessary
  if(args.length === 1)
    ast.splice(0, 3, syms.def, args[0], argv[0])
  else {
    //check if the fields in the batch use fields set later
    //_earlier_ in the batch. That means we need tmp vars.

    var simple = true, _i
    for(var i = 0; i < argv.length; i++)
      simple = simple && (function R (ast) {
        return (
          isSymbol (ast)
        ? (_i = _args[ast.description]) === undefined || _i >= i
        : isArray  (ast)
        ? ast.every(R)
        : true
        )
      })(argv[i])
    if(simple)
      [].splice.apply(ast, [0, 3, syms.block].concat(
          argv.map((v, i) => [syms.def, args[i], v])
        ))
    else
      [].splice.apply(ast, [0, 3, syms.block].concat(
          argv.map((v, i) => [syms.def, Symbol('tmp_'+i), v])
        ).concat(
          args.map((s, i) => [syms.def, s, Symbol('tmp_'+i)])
        ))
  }
  return ast
}

function scopify (ast, scope, current, hygene) {
  current = current || 0
  hygene = hygene || 0

  var start = 0
  if(isArray(ast)) {
    if(ast[0] === syms.batch) {
      return scopify(batch(ast), scope, current, hygene)
    }

    if(ast[0] === syms.def) {
      var k = ast[1].description
      //traverse the value first, because the key doesn't get set
      //until the expression is evaluated.
      if(isSymbol(ast[2])) {
        if(scope[ast[2].description])
          ast[2] = scope[ast[2].description]
      }
      else
        hygene = scopify(ast[2], scope, current, hygene)
      ast[1] = scope[k] = Symbol(current === 0 ? k : k+'__'+current)
      return hygene
    }
    else if(ast[0] === syms.scope) {
      scope = {__proto__: scope}
      start = 1
      //scope turned into ordinary branch
      //(since `scope` isn't part of wasm)
      ast[0] = syms.block
      current = ++hygene
    }

    for(var i = start; i < ast.length; i++) {
      if(isArray(ast[i]))
        hygene = scopify(ast[i], scope, current, hygene)
      else if(isSymbol(ast[i]))
        if(scope[ast[i].description])
          ast[i] = scope[ast[i].description]
    }

  }
  return hygene
}

module.exports = function (ast) {
  scopify(ast, {})
  return tidy(ast)
}
