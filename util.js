var syms       = require('./symbols')
var internal   = require('./internal')
var wasmString = require('wasm-string')
var internal   = require('./internal')

var isArray = Array.isArray

function isObject(o) {
  return o && 'object' === typeof o && !isArray(o)
}

function isDefined(d) {
  return 'undefined' !== typeof d
}

function isSymbol(s) {
  return 'symbol' === typeof s
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

function isBoundFun (ary) {
  return isArray(ary) && ary[0] === internal.bound_fun
}

function isSystemFun(ary) {
  return isArray(ary) && ary[0] === internal.system_fun
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

function isCore (c) {
  return isSymbol(c) && c === syms[c.description]
}

function isLookup(sym) {
  return !isCore(sym) && (
    isSymbol(sym) ||
    (isArray(sym) && sym[0] === syms.get && sym.every(isSymbol))
  )
}

exports.isDefined   = isDefined
exports.isSymbol    = isSymbol
exports.isArray     = isArray
exports.isObject    = isObject
exports.isEmpty     = isEmpty
exports.isNull      = isNull
exports.isBoolean   = isBoolean
exports.isString    = isString
exports.isBuffer    = isBuffer
exports.isFunction  = isFunction
exports.isFun       = isFun
exports.isBoundFun  = isBoundFun
exports.isSystemFun = isSystemFun
exports.isNumber    = isNumber
exports.isBasic     = isBasic
exports.isCore      = isCore
exports.isLookup    = isLookup

function parseFun (fun) {
  if(fun.length < 3 || fun.length > 5) {
    throw new Error('incorrect length of fun expression:'+stringify(fun))
  }
  if(isSymbol(fun[1]) || isBoundFun(fun))
    return {
      fun: true,
      name: fun[1], args:fun[2], body: fun[3], scope: fun[4]
    }
  else
    return {
      fun: true,
      name: null, args:fun[1], body: fun[2], scope: fun[3]
    }
}

exports.parseFun = parseFun

function indent(s) {
    return (''+s).split('\n').map(line => '  ' + line).join('\n')
}

function stringify_list (l, inject) {
  var s = '('
  for(var i = 0; i < l.length; i++) {
    var item = pretty(l[i], inject)
    if(s.length + item.length < 40)
      s += item + ' '
    else
      s += '\n' + indent(item)
  }

  return s.trim() + (s.split('\n').length > 5 ? '\n)' : ')')
}

function stringify (s) {
  if(isBuffer(s)) return wasmString.encode(s)
  if(isArray(s)) return '(' + s.map(stringify).join(' ') + ')'
  if(isSymbol(s)) return s.description
  if(isFunction(s)) return indent(stringify(s.source))
  if(isObject(s)) return '{object}'
  return JSON.stringify(s)
}

function pretty (s, inject) {
  if(inject) {
    var v = inject(s)
    if(v) return v
  }
  if(isBuffer(s)) return wasmString.encode(s)
  if(isArray(s)) return stringify_list(s, inject)
  if(isSymbol(s)) return s.description
  if(isFunction(s)) return indent(stringify(s.source))
  if(s === null) return ''
  if(s === undefined) return 'undefined'
  if(isObject(s)) {
    var s = '{\n'
      for(var k in s)
        s += '  ' +k +':\n' + indent(pretty(s[k]))
    return s.trim() + '}'
  }
  return JSON.stringify(s)
}

exports.stringify = stringify
exports.pretty = pretty

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

var isRef = exports.isRef = function (ref) {
  return isSymbol(ref) && /^\$f_\d+$/.test(ref.description)
}

exports.readBuffer = function (memory, ptr) {
  var len = memory.readUInt32LE(ptr)
  return memory.slice(4+ptr, 4+ptr+len)
}

exports.meta = function meta (source, dest) {
  if(!(isArray(source) && isArray(dest)))
    return dest

  if(!dest.meta) dest.meta = source.meta

  return dest
}
