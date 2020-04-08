var {
  isDefined, isSymbol, isArray,
  isDef, isEmpty, isFunction, isNumber, isBound, isFun,
  eqSymbol, equals,
  isExpressionTree, traverse
} = require('./util')
var syms = require('./symbols')


// take a tree of expanded bound functions and remap them into a topographically
// ordered set of definitions, with lexical references.

function searchFunctions(tree, funs) {
  funs = funs || []
  if(isFun(tree) && !~funs.indexOf(tree)) {
    funs.push(tree)
    traverse(tree, function (branch) {
      //find all bound functions referenced by a variable name.
      if(isFun(branch[0]) /*&& isFullyBound(branch[1])*/) {
        var id = funs.indexOf(branch[0])
        if(!~id) {
          id = funs.push(branch[0])
          searchFunctions(branch[0], funs)
        }
  //      return Symbol('f_'+id)
      }
    })
  }
  return funs
}

function remap (tree, funs) {
  return tree.map(branch => {
    if(!isArray(branch)) return branch
    if(isFun(branch[0])) {
      return [Symbol('$f_'+funs.indexOf(branch[0]))].concat(branch.slice(1))
    }
    else
      return remap(branch, funs)
  })
}


//UNROLL:
// 0. evaluate the top level - binds closure vars, and calls setup functions, returns exports.
// 1. traverse exports, collect all functions.
// 2. reoutput all functions, as defs.
// 3. convert exports to references to those defs.

var flatten = require('./flatten')

module.exports = function unroll (exports) {
  var funs = searchFunctions(exports, [])
  function toRef(fun) {
    return !isFun(fun) ? fun : Symbol('$f_'+funs.indexOf(fun))
  }

  //flatten function bodies
  var def_funs = funs.map(function (fun, i) {
    fun = remap(fun, funs)
    //flatten the body
    fun[fun.length-1] = flatten(fun[fun.length-1])
    return [syms.def, Symbol('$f_'+i), fun]
  })

  return [syms.module]
    .concat(def_funs)
    .concat(
      isFun(exports)
      ? [[syms.export, toRef(exports)]]
      : exports.map(e => [syms.export, e[0], toRef(e[1])])
    )
}
