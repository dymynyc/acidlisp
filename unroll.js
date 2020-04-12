var {
  isDefined, isSymbol, isArray,
  isDef, isEmpty, isFunction, isNumber, isBound, isFun, isBuffer,
  eqSymbol, equals, getFunctions, getStrings,
  isExpressionTree, traverse, toRef
} = require('./util')
var syms = require('./symbols')

// take a tree of expanded bound functions and remap them into a topographically
// ordered set of definitions, with lexical references.

function remap (tree, funs) {
  return tree.map(branch => {
    if(!isArray(branch)) return branch
    if(isFun(branch[0])) {
      return [toRef(funs.indexOf(branch[0]))].concat(remap(branch.slice(1), funs))
    }
    else
      return remap(branch, funs)
  })
}

var LITERALS = Symbol('$LITERALS$')

function remapStrings(tree, strings) {
  return tree.map(branch => {
    if(isBuffer(branch))
      return [syms.get, LITERALS, strings.indexOf(branch)]
    else if(isArray(branch))
      return remapStrings(branch, strings)
    else
      return branch
  })
}

//UNROLL:
// 0. evaluate the top level - binds closure vars, and calls setup functions, returns exports.
// 1. traverse exports, collect all functions.
// 2. reoutput all functions, as defs.
// 3. convert exports to references to those defs.

var flatten = require('./flatten')

module.exports = function unroll (exports) {
  var funs = getFunctions(exports, []).reverse()
  //note: we don't need to worry about strings in import statements
  //because they should be evalled away by now
  var strings = getStrings(exports, [])
  function createRef(fun) {
    return !isFun(fun) ? fun : toRef(funs.indexOf(fun))
  }
  
  //flatten function bodies
  var def_funs = funs.map(function (fun, i) {
    fun = remap(fun, funs) //replace inlined functions with references.
    fun[fun.length-1] = flatten(fun[fun.length-1]) //flatten the body
    return [syms.def, toRef(i, fun), fun]
  })

  def_funs = remapStrings(def_funs, strings)

  return [syms.module]
    .concat([[syms.def, LITERALS, [Symbol('list')].concat(strings)]])
    .concat(def_funs)
    .concat(
      isFun(exports)
      ? [[syms.export, createRef(exports)]]
      : exports.map(e => [syms.export, e[0], createRef(e[1])])
    )
}
