var syms = require('./symbols')
var {
  isArray, isSymbol, isFun, parseFun, stringify
} = require('./util')


//apply after parsing, before eval.
//apply to each module loaded.
//only remap variables declared.

module.exports = function (ast) {
  var k = 0
  function update (sym) {
    return Symbol(sym.description+'_'+(++k))
  }
  ;(function remap (ast, scope) {
    if(isArray(ast)) {
      var head = ast[0]
      if(head === syms.def) {
        if(isSymbol(ast[2]) && scope[ast[2].description])
          ast[2] = scope[ast[2].description]
        else
          remap(ast[2], scope)
        if(isArray(ast[1]) && syms.def === ast[1][0]) {
          scope[ast[1][1].description] = (ast[1][1] = update(ast[1][1]))
        }
        else if(isSymbol(ast[1]))
          scope[ast[1].description] = (ast[1] = update(ast[1]))
        else
          throw new Error('invalid def:'+stringify(ast))
      }
      else if (isFun(ast)) {
        // rename args
        scope = {__proto__: scope}
        var {name, args, body} = parseFun(ast)
        args.forEach(function (sym, i) {
          scope[sym.description] = args[i] = update(sym)
        })
        if(name)
          scope[name.description] = name //name can stay the same.
        remap(body, scope)
      }
      else
        for(var i = 0; i < ast.length; i++)
          if(isSymbol(ast[i]) && scope[ast[i].description]) {
            ast[i] = scope[ast[i].description]
          }
          else if(isArray(ast[i]))
            remap(ast[i], scope)
    }
    return ast
  })(ast, {})
  return ast
}
