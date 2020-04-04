
var {
  isDefined, isSymbol, isArray,
  isDef, isEmpty, isFunction, isNumber, isBound,
  eqSymbol, equals, stringify, traverse
} = require('../util')

function compile (ast) {
  var funs = []
  ;(function each (tree) {
    if(isFunction(tree)) {
      if(!~funs.indexOf(tree)) {
        funs.push(tree)
        each(tree.source)
      }
    }
    else if(isArray(tree))
      tree.forEach(each)
  })(ast)

  return '(module\n' + funs.map(fun).join('\n') + '\n)'
}

function fun (ast) {

}
