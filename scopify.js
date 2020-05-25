var {isArray, isSymbol} = require('./util')
var syms = require('./symbols')

function scopify (ast, scope, current, hygene) {
  current = current || 0
  hygene = hygene || 0

  var start = 0
  if(isArray(ast)) {
    if(ast[0] === syms.batch) {
      var args = ast[1]
      var argv = ast[2]
      //this works but kinda want to not create tmp vars
      //unless necessary
      ;[].splice.apply(ast, [0, 3, syms.block].concat(
          argv.map((v, i) => [syms.def, Symbol('tmp_'+i), v])
        ).concat(
          args.map((s, i) => [syms.def, s, Symbol('tmp_'+i)])
        ))

      return scopify(ast, scope, current, hygene)
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
  return ast
}
