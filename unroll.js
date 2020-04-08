var {
  isDefined, isSymbol, isArray,
  isDef, isEmpty, isFunction, isNumber, isBound, isFun,
  eqSymbol, equals,
  isExpressionTree, traverse, toRef
} = require('./util')
var syms = require('./symbols')


// take a tree of expanded bound functions and remap them into a topographically
// ordered set of definitions, with lexical references.

function searchFunctions(tree, funs) {
  funs = funs || []
  //XXX tidy
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
      }
    })
  }
  return funs
}

function remap (tree, funs) {
  return tree.map(branch => {
    if(!isArray(branch)) return branch
    if(isFun(branch[0])) {
      return [toRef(funs.indexOf(branch[0]))].concat(branch.slice(1))
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
  function createRef(fun) {
    return !isFun(fun) ? fun : toRef(funs.indexOf(fun))
  }

  //flatten function bodies
  var def_funs = funs.map(function (fun, i) {
    fun = remap(fun, funs)
    //flatten the body
    fun[fun.length-1] = flatten(fun[fun.length-1])
    return [syms.def, toRef(funs.indexOf(fun)), fun]
  })

  return [syms.module]
    .concat(def_funs)
    .concat(
      isFun(exports)
      ? [[syms.export, createRef(exports)]]
      : exports.map(e => [syms.export, e[0], createRef(e[1])])
    )
}
