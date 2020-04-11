var syms = require('./symbols')
var wasmString = require('wasm-string')

var isArray = Array.isArray

function isDefined(d) {
  return 'undefined' !== typeof d
}

function isSymbol(s) {
  return 'symbol' === typeof s
}

function isDef(s) {
  return syms.def === s
}

function isEmpty (e) {
  return isArray(e) && e.length === 0
}

function isFunction (f) {
  return 'function' === typeof f
}

function isFun (f) {
  return isArray(f) && f[0] === syms.fun
}

function isMac (m) {
  return isArray(m) && m[0] === syms.mac
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

var isBuffer = Buffer.isBuffer

function isBasic(b) {
  return isBuffer(b) || isNumber(b) || isNull(b) || isBoolean(b) || isString(b)
}
function isBound(b) {
  return (
    isFunction(b) ||
    (isArray(b) && b.every(isBound)) ||
    isBasic(b)
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
exports.isBuffer   = isBuffer
exports.isFunction = isFunction
exports.isFun      = isFun
exports.isMac      = isMac
exports.isNumber   = isNumber
exports.isBasic    = isBasic
exports.isBound    = isBound
exports.eqSymbol   = eqSymbol
exports.equals     = equals

function stringify (s, env) {
  if(isArray(s) && isSymbol(s[0]) && eqSymbol(s[0], 'ref'))
    return isFunction (s[1]) ? stringify(s[2]) : s[1]
  if(isBuffer(s)) return wasmString.encode(s)
  if(isArray(s)) return '(' + s.map(stringify).join(' ') + ')'
  if(isSymbol(s)) return s.description
  if(isFunction(s)) return stringify(s.source)
  return JSON.stringify(s)
}

exports.stringify = stringify

exports.toRef = function (n, fun) {
  if(!~n) throw new Error('missing reference, for:'+stringify(fun))
  return Symbol('$f_'+n)
}
var isRef = exports.isRef = function (ref) {
  return isSymbol(ref) && /^\$f_\d+$/.test(ref.description)
}
exports.fromRef = function (ref) {
  return isRef(ref) ? +ref.description.substring(3) : ref
}


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
exports.traverse = traverse

function id (e) { return e }

function map (tree, branch, leaf) {
  if(!leaf) leaf = id
  if(isArray(tree)) {
    var b = branch(tree)
    if(isDefined(b)) return b
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
    if(branch[0] === syms.def)
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

function isFun(tree) {
  return isArray(tree) && tree[0] === syms.fun
}

var isExpressionTree = exports.isExpressionTree = function (tree) {
  if(!isArray(tree)) return true
  else if(
    tree[0] === syms.if ||
    tree[0] === syms.loop ||
    tree[0] === syms.block ||
    isSymbol(tree[0]) && /_store$/.test(tree[0].description)

  ) return false
  else
    return tree.every(exports.isExpressionTree)
}


exports.inline = function (tree) {
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
