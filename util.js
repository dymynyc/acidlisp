var isArray = Array.isArray

function isDefined(d) {
  return 'undefined' !== typeof d
}

function isSymbol(s) {
  return 'symbol' === typeof s
}

function isDef(s) {
  return isSymbol(s) && 'def' === s.description
}

function isEmpty (e) {
  return isArray(e) && e.length === 0
}

function isFunction (f) {
  return 'function' === typeof f
}

function isNumber(n) {
  return 'number' === typeof n
}

function isNull (n) {
  return null === typeof n
}

function isBoolean(b) {
  return 'boolean' === typeof b
}

function isString(s) {
  return 'string' === typeof s
}

function isBasic(b) {
  return isNumber(b) || isNull(b) || isBoolean(b) || isString(b)
}
function isBound(b) {
  return (
     isArray(b) && isSymbol(b[0]) && b[0].description == 'ref'
  || isFunction(b)
  || (isArray(b) && b.every(isBound))
  || isBasic(b)
  )
}

function eqSymbol(sym, str) {
  return isSymbol(sym) && str === sym.description
}

//(def (name args...) (body))
function equals (a, b) {
  if(isArray(a) && isArray(b))
    return (a.length === b.length) && a.every((v, i) => equals(v, b[i]))
  return a === b
}

exports.isDefined  = isDefined
exports.isSymbol   = isSymbol
exports.isArray    = isArray
exports.isDef      = isDef
exports.isEmpty    = isEmpty
exports.isNull     = isNull
exports.isBoolean  = isBoolean
exports.isString   = isString
exports.isFunction = isFunction
exports.isNumber   = isNumber
exports.isBasic    = isBasic
exports.isBound    = isBound
exports.eqSymbol   = eqSymbol
exports.equals     = equals

function traverse (tree, each_branch, each_leaf) {
  if(isFunction(tree) && tree.source)
    tree = tree.source
  if(isArray(tree)) {
    if(each_branch && false !== each_branch(tree))
      tree.forEach(t => traverse(t, each_branch, each_leaf))
  }
  else if(each_leaf)
      each_leaf(tree)
}

function id (e) { return e }

function map (tree, branch, leaf) {
  if(!leaf) leaf = id
  if(isArray(tree)) {
    var b = branch(tree)
    if('undefined' !== b) return b
    else
      return tree.map(e => tree(e, branch, leaf))
  }
  else
    return leaf(tree)
}

var keywords = {ref:true, def:true, fun:true}
exports.freeVariables = function (fun) {
  if(isFunction (fun))
    fun = fun.source

  var name, args, body
  if(isSymbol(fun[1]))
    name = fun[1], args = fun[2], body = fun.slice(3)
  else
    name = null, args = fun[1], body = fun.slice(2)

  var vars = {}, free = {}
  args.forEach(k => vars[k.description] = true)
  traverse(body, function (branch) {
    if(eqSymbol(branch[0], 'def'))
      vars[branch[1].description] = true
    else if(eqSymbol(branch[0], 'ref') && isFunction (branch[1]))
      return false

  }, function (leaf) {
    if(isSymbol(leaf) && !keywords[leaf.description] && !vars[leaf.description])
      free[leaf.description] = true
  })
  return Object.keys(free).map(k => Symbol(k))
}

exports.isRecursive = function (fun) {
  if(isSymbol(fun[1])) {
    name = fun[1], args = fun[2], body = fun.slice(3)
  }
  else
    return false //can't be recursive without a self reference

  //could a function use a self reference but not be recursive?
  //or, a function could be passed a reference to it self, and be recursive that way?
  //true... but it would need to be passed as a scope reference.
  //higher order functions are a bit more suspect.
  //higher order macros are safer because they can be expanded then statically analyzed.
}

//does a function take an argument that it then calls?
exports.isHigherOrder = function (fun) {
  if(isSymbol(fun[1]))
    name = fun[1], args = fun[2], body = fun.slice(3)
  else
    name = null, args = fun[1], body = fun.slice(2)
  var args = {}, higher = {}
  _args.forEach(k => args[k.description] = true)

  traverse(body, function (branch) {
    if(isSymbol(branch[0]) && args[branch[0].description])
      higher[branch[0].description] = true
  })
}

// take a tree of expanded bound functions and remap them into a topographically
// ordered set of definitions, with lexical references.

function remap (tree, funs) {
  if(isFunction(tree)) tree = tree.source
  return tree.map(branch => {
    if(!isArray(branch)) return branch
    if(eqSymbol(branch[0], 'ref') && isFunction(branch[1]) && isSymbol(branch[2])) {
      return Symbol('f'+funs.indexOf(branch[1]))
    }
    else
      return remap(branch, funs)
  })
}

exports.stringify = function stringify (s, env) {
  if(isArray(s) && isSymbol(s[0]) && eqSymbol(s[0], 'ref'))
    return isFunction (s[1]) ? stringify(s[2]) : s[1]
  if(isArray(s)) return '(' + s.map(stringify).join(' ') + ')'
  if(isSymbol(s)) return s.description
  if(isFunction(s)) return stringify(s.source)
  return JSON.stringify(s)
}

exports.getExports = function (tree) {
  return tree.filter(e => isArray(e) && eqSymbol(e[0], 'export'))
    .map(e => isDefined(e[2]) ? [e[1], e[2]] : [null, e[1]])
}

function searchFunctions(tree, funs) {
  funs = funs || []
  traverse(tree, function (branch) {
    //find all bound functions referenced by a variable name.
    if(eqSymbol(branch[0], 'ref') && isFunction(branch[1]) && isSymbol(branch[2])) {
      var id = funs.indexOf(branch[1])
      if(!~id) {
        id = funs.push(branch[1])
        searchFunctions(branch[1].source, funs)
      }
      return Symbol('f'+id)
    }
  })
  return funs
}

exports.unrollExports = function (tree) {
  console.log("EXPORTS", exports.getExports(tree))
  
}
exports.unroll = function unroll (tree) {
  var funs = searchFunctions(tree, [])
  return [Symbol('module')]
    .concat(funs.map((fn, i) => [Symbol('def'), Symbol('$f'+i), remap(fn.source, funs)] ))
    .concat([[Symbol('export'), remap(tree, funs)]])
}

exports.inline = function (tree) {
  console.log(tree)
  var fn = tree[0]
  var args = tree.slice(1)
  var fn_args = isSymbol(fn[1]) ? fn[2] : fn[1]
  var body    = isSymbol(fn[1]) ? fn[3] : fn[2]
  var obj = {}
  fn_args.forEach(function (k, i) {
    obj[k.description] = args[i]
  })
  return (function map (body) {
    if(isSymbol(body) && isDefined(obj[body.description])) return obj[body.description]
    else if(isArray(body)) return body.map(map)
    else return body //numbers, etc
  })(body)
}

function isFun(tree) {
  return isArray(tree) && eqSymbol(tree[0], 'fun')
}

    //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
   // FLATTEN                            //
  // take everything-is-an-expression   //
 // and convert it to wasm statements. //
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

var DEF = Symbol('def'), IF = Symbol('if'), BLOCK = Symbol('block'), LOOP = Symbol('loop')

function maybe (tree, sym) {
  if(isArray(tree) && eqSymbol(tree[0], 'block') && isSymbol(tree[tree.length-1]))
    tree[tree.length-1] = [DEF, sym, tree[tree.length-1]]
  return tree
}

function last (ary) {
  return ary[ary.length-1]
}

//trim removes the last value... which might have been added by maybe.
//yeah, this is ugly.
function trim(exprs) {
  if(exprs.length && eqSymbol(last(exprs)[0], 'block') && isSymbol( last(last(exprs)) ))
    last(exprs).pop()
}

var statements = {if:true, loop: true}
var isExpressionTree = exports.isExpressionTree = function (tree) {
  if(!isArray(tree)) return true
  else if(
    eqSymbol(tree[0], 'if') ||
    eqSymbol(tree[0], 'loop') ||
    eqSymbol(tree[0], 'block')
  ) return false
  else
    return tree.every(exports.isExpressionTree)
}


function $ (n) {
  return Symbol('$'+n)
}

function trim (tree) {
  if(isArray(tree) && tree.length == 2 && eqSymbol(tree[0], 'block'))
    return tree[1]
  return tree
}

function insertDef(tree, sym) {
  if(isExpressionTree(tree))
    return [DEF, sym, tree]
  else {
    var _tree = exports.flatten(tree)
    if(isSymbol(last(_tree))) {
      //it so happens that the trailing symbol is the one
      //we need to define, then it will already be set, so just insert it.
      if(eqSymbol(last(_tree), sym.description)) {
        _tree.pop()
        return trim(_tree)
      }
    }
    _tree[tree.length-1] = [DEF, sym, last(tree)]
    return trim(_tree)
  }
}

exports.flatten = function flatten (tree, n) {
  n = n || 1
  if(isExpressionTree(tree)) return tree

  if(eqSymbol(tree[0], 'if')) {
    var sym = $(n)
    if(isExpressionTree(tree[1]))
      return [BLOCK, [IF,
        tree[1], insertDef(tree[2], sym), insertDef(tree[3], sym)
      ], sym]
  }
  else if(eqSymbol(tree[0], 'block')) {
    var block = [BLOCK]
    for(var i = 1; i < tree.length; i++) {
      if(isExpressionTree(tree[i]))
        block.push(tree[i])
      else {
        var _tree = flatten(tree[i])
        if(!eqSymbol(_tree[0], 'block'))
          throw new Error('expected block!:'+stringify(_tree))
        //if we are not at the last block expression
        //we can dump the value symbol
        if(isSymbol(last(_tree) && i + 1 < tree.length))
          _tree.pop()

        //append the items into the same block
        for(var j = 1; j < _tree.length; j++)
          block.push(_tree[j])

        return block
      }
    }
  }
  else if(eqSymbol(tree[0], 'loop')) {
    return [BLOCK, [LOOP,
      isExpressionTree(tree[1]) ? tree[1] : flatten(tree[1], n),
      insertDef(
        isExpressionTree(tree[2]) ? tree[2] : flatten(tree[2], n),
        $(n)
      )], $(n)]
  }
  else {
    var pre = [BLOCK]
    var _tree = [tree[0]]
    tree.forEach((branch,i) => {
      if(isExpressionTree(branch)) _tree[i] = branch
      else {
        var _branch = flatten(branch, n+i)
        pre.push(_branch)
        if(isSymbol(last(_branch))) {
          _tree[i] = _branch.pop()
          if(_branch.length == 2) //[block, something]
            pre[pre.length-1] = _branch[1]
        }
        else {
          _branch[_branch.length-1] = [DEF, $(n+i), last(_branch)]
          _tree[i] = $(n+i)
        }
      }
    })
    pre.push(_tree)
    return pre
  }
}

return
exports.flatten = function flatten_all (tree, n) {
  n = n || 0
  var i = 0, exprs = []

  if(isBasic(tree))
    return true [DEF, Symbol('$'+n), tree]

  ;(function flatten (tree) {
    if(isFun(tree)) //skip
      ;
    else if(isArray(tree)) {
      if(eqSymbol(tree[0], 'if')) {
        var m = flatten(tree[1])

        var o = Symbol('$'+n)
        var p = Symbol('$'+(++n))

        //trim off the hanging value, if we don't need it.
        trim(exprs)
       exprs.push([BLOCK, [IF,
          m ? o : tree[1],
          maybe(flatten_all(tree[2], n), p),
          maybe(flatten_all(tree[3], n), p)
        ], p])
        return true
      }
      else if(eqSymbol(tree[0], 'loop')) {
        var p = Symbol('$'+(++n))

        exprs.push([BLOCK, [LOOP, tree[1], tree[2]], p])
        return true
      }
      else if(eqSymbol(tree[0], 'block')) {
        for(var i = 1; i < tree.length; i++)
          flatten(tree[i])
//        exprs.push(tree)
        return true
      }
      else {
        for(var i = 1; i < tree.length; i++) {
          var v = tree[i]
          if(flatten(v)) tree[i] = Symbol('$'+n)
        }

        trim(exprs) // trim last value
        var m = Symbol('$'+(++n))
        exprs.push([BLOCK, [DEF, m, tree], m])
        return true
      }
    }
  })(tree)

  return exprs.length === 1 ? exprs[0] : [BLOCK].concat(exprs)
}
