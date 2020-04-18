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

//note: decided to use buffers instead of strings.
//(since reimplementing js string quirks is a bad idea)
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

function parseFun (fun) {
  if(fun.length < 3 || fun.length > 4) {
    throw new Error('incorrect length of fun expression:'+stringify(mac))
  }
  if(isSymbol(fun[1]))
    return {
      fun: syms.fun === fun[0], mac: syms.mac === fun[0],
      name: fun[1], args:fun[2], body: fun[3]
    }
  else
    return {
      fun: syms.fun === fun[0], mac: syms.mac === fun[0],
      name: null, args:fun[1], body: fun[2]
    }
}

exports.parseFun = parseFun

exports.toEnv = function (args, argv, _env) {
  var env = {__proto__: _env}
  if(argv.length < args.length)
    throw new Error('too few arguments, expected:'+args.length+' got:'+argv.length)
  args.forEach((s, i) => env[s.description] = argv[i])
  return env
}

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

function getThings (tree, isThing, things) {
  things = things || []
  ;(function maybe(it) {
    if(isThing(it) && !~things.indexOf(it)) {
      things.push(it)
      if(isArray(it))
        for(var i = 0; i < it.length; i++)
          maybe(it[i])
    }
    else if(isArray(it))
      it.forEach(maybe)
  })(tree)
  return things
}

exports.getFunctions = function (tree, funs) {
  return getThings(tree, isFun, funs)
}
exports.getStrings = function (tree, strings) {
  return getThings(tree, isBuffer, strings)
}

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

exports.readBuffer = function (memory, ptr) {
  var len = memory.readUInt32LE(ptr)
  return memory.slice(4+ptr, 4+ptr+len)
}

var isExpressionTree = exports.isExpressionTree = function (tree) {
  if(!isArray(tree)) return true
  else if(
    tree[0] === syms.if ||
    tree[0] === syms.loop ||
    tree[0] === syms.block ||
    isSymbol(tree[0]) && /_store\d*$/.test(tree[0].description)

  ) return false
  else
    return tree.every(exports.isExpressionTree)
}
