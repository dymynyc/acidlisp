var {
  isArray, isFun, getFunctions, toRef
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
  function createRef(fun) {
    return !isFun(fun) ? fun : toRef(funs.indexOf(fun))
  }

  //flatten function bodies
  var def_funs = funs.map(function (fun, i) {
    fun = remap(fun, funs) //replace inlined functions with references.
    fun[fun.length-1] = flatten(fun[fun.length-1]) //flatten the body
    return [syms.def, toRef(i, fun), fun]
  })
  console.log('exports', exports)
  return [syms.module]
    .concat(def_funs)
    .concat(
      isFun(exports)
      ? [[syms.export, createRef(exports)]]
      : exports.map(e => [syms.export, e[0], createRef(e[1])])
    )
}
