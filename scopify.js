var {isArray, isSymbol} = require('./util')
var syms = require('./symbols')

module.exports = function scopify (ast, scope, current, hygene) {
  current = current || 0
  hygene = hygene || 0
  if(isArray(ast)) {
    if(ast[0] === syms.def) {
      var k = ast[1].description
      //traverse the value first, because the key doesn't get set
      //until the expression is evaluated.
      scopify(ast[2], scope, current, hygene)
      ast[1] = scope[k] = Symbol(current === 0 ? k : k+'__'+current)
    }
    else if(ast[0] === syms.scope) {
      scope = {__proto__: scope}
      //scope turned into ordinary branch
      //(since `scope` isn't part of wasm)
      ast[0] = syms.block
      current = ++hygene
      for(var i = 1; i < ast.length; i++)
        hygene = scopify(ast[i], scope, current, hygene)
    }
    else {
      for(var i = 0; i < ast.length; i++) {
        if(isSymbol(ast[i])) {
          if(scope[ast[i].description])
            ast[i] = scope[ast[i].description]
        }
        else if(isArray(ast[i]))
          hygene = scopify(ast[i], scope, current, hygene)
      }
    }
  }
  return hygene
}
