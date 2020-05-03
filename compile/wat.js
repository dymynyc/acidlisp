var {
  isDefined, isSymbol, isArray, isBuffer,
  isDef, isFun, isEmpty, isFunction, isNumber, isBound, isString,
  isSystemFun, readBuffer,
  equals, stringify,
  getFunctions, getStrings,
  isExpressionTree,
  toRef, fromRef, isRef,
  pretty
} = require('../util')

var syms = require('../symbols')

function isSingleLine(s) {
  return !/\n/.test(s)
}

var wasmSyms = {}

function S(string) {
  return wasmSyms[string] = wasmSyms[string] || Symbol(string)
}

function $ (sym) {
  var string = isSymbol(sym) ? sym.description : sym
  return S(string[0] == '$' ? string : '$'+string)
}

function w(name, ary) {
  if(ary == null) return [S(name)]
  return [S(name)].concat(isArray(ary) ? ary : [ary])
}

var result_i32 = w('result', S('i32'))
var param_i32 = w('param', S('i32'))

function getDefs (ast, defs) {
  defs = defs || {}
  if(isArray(ast)) {
    if(syms.def === ast[0]){// || syms.set === ast[0]) {
      defs[ast[1].description] = true
      if(isArray(ast[2])) {
        return getDefs(ast[2], defs)
      }
    }
    else
      ast.forEach(a => getDefs(a, defs))
  }
  return Object.keys(defs).map(k => Symbol(k))
}

function getImports (ast) {
  var imports = []
  for(var i = 0; i < ast.length; i++)
    if(ast[i][0] === syms.def && isSystemFun(ast[i][2]))
      imports.push(ast[i])
  return imports
}

function indent (src) {
  return src.split('\n').map(line => '  ' + line).join('\n')
}

function getFun (f, message) {
  if(isFunction (f)) throw new Error('js functions cannot be compiled to wat')
  if(isFun (f)) return f
  throw new Error('cannot find function:'+stringify(f)+ ' ' + (message || ''))
}

function toHex (b) {
  return '"'+[].slice.call(b).map(c => '\\'+Buffer.from([c]).toString('hex')).join('')+'"'
}

function toName(fn_name) {
  if(!isSymbol(fn_name)) throw new Error('name is not symbol:' + stringify(fn_name))
  return S(isRef(fn_name) ? fromRef(fn_name) : '$'+fn_name.description)
}

//TODO: fix this pointers thing
var pointers = []
function compile (ast, isBlock) {
  if(isArray(ast)) {
    //first, check if it's a core method
    var fn_name = ast[0]
    if(!isSymbol(fn_name))
      throw new Error('name is non-symbol:'+pretty(ast) + ' at:'+JSON.stringify(ast.meta))
    var fn = exports[fn_name.description]
    if(fn) {
      if(!isFunction(fn)) throw new Error('cannot compile:'+fn_name.description)
      return fn(ast.slice(1), isBlock)
    }
    else {
      var c = w('call', [toName(fn_name)].concat(ast.slice(1).map(e => compile(e, false))) )
      return isBlock ? w('drop', [c]) : c
    }
  }
  //the following values can't do anything in a block position
  else if(isBlock)
    return null
  else if(isNumber(ast))
    return w('i32.const', ast) //TODO other number types
  else if(isSymbol(ast))
    return w('local.get', $(ast))
  else if(ast === null) return compile(0)
  else
    throw new Error('cannot compile unsupported type:'+stringify(ast))

  //hard coded strings will be encoded in a data section
}

exports = module.exports = function (ast, env, stringify) {
  return (stringify || pretty) (exports.module(ast, env))
}
exports.S = S
function assertRef (r) {
  if(isRef(r)) return r
  else if(isSymbol(r))
    return r
  else
    throw new Error('expected function ref:'+stringify(r))
}

exports.module = function (ast, env) {
  var imports = getImports(ast)
  var funs = getFunctions(ast)
  var ptr = 0, free = 0
  pointers = []
  env = env || {}
  var free, data
  var memory = env.memory
  if(env.globals) free = env.globals[0]
  if(memory)      data = memory.slice(0, free)

  free = ptr //where the next piece of data should go
  var ref
  return w('module',
    imports.map(e => exports.system_fun(e, env))
    .concat([
      memory && w('memory', [w('export', Buffer.from('memory')), 1]) || null,
      //a global variable that points to the start of the free data.
      //data, literals (strings so far)
      env.globals && w('global', [
        $('FREE'),
        w('mut', S('i32')),
        compile(free || 0, false)
      ]) || null,

      data &&
      w('data',
        [0, w('offset', compile(0)), data]
      ) || null
    ])
    .concat(funs.map((e, i) => exports.fun(e.slice(1)) ))
    .concat(
      //exports
      ast.filter(e => e[0] === syms.export).map(e => {
        if(isSymbol(e[1]) && e[2]) {// named export
          ref = assertRef(e[2])
          var export_name = e[1].description
          return w('export', [Buffer.from(export_name), w('func', toName(ref))])
        }
        else {
          ref = assertRef(e[1])
          var export_name = "main" //default export name if you only export one thing
        }
        return w('export', [Buffer.from(export_name), w('func', toName(ref))])
      })
    ))
}

exports.fun = function (ast) {
  ast = ast.slice(0)
  var name = isSymbol(ast[0]) ? $(ast.shift()) : ''
  var args = ast.shift()
  var body = ast[0]
  var defs = getDefs(body) || []
  return w('func', [name]
    .concat(args.map(e => w('param', [$(e), S('i32') ]) ))
    .concat([result_i32])
    .concat(defs.map(d => w('local', [$(d), S('i32') ])))
    .concat([compile(body, false)])
  )
}

exports.system_fun = function (ast, env) {
  var name = ast[1]
  var fun = ast[2]
  var params = fun[2]
  return w('import', [
    readBuffer(env.memory, fun[3][0]),
    readBuffer(env.memory, fun[3][1]),
    w('func', [$(name)]
      .concat(params.map(e => param_i32))
      .concat([result_i32]))
  ])

}

exports.block = function (args, isBlock) {
  isBlock = isBlock === true
  return w('block',
    [isBlock ? null : result_i32]
    .concat(args.map((e,i) => {
      return compile(e, i+1 < args.length ? true : isBlock)
    })))
}

exports.if = function ([test, then, e_then], isBlock) {
  return w('if', [
    isBlock ? null : result_i32,
    compile(test, false),
    compile(then, isBlock),
    compile(e_then || 0, isBlock)
  ])
}

exports.loop = function ([test, iter, result], isBlock) {
  if(!isBlock)
    return w('loop', [result_i32,
      w('if', [
        compile(test, false),
        w('then', [compile(iter, true), w('br', [1])]),
      ]),
      compile(result || 0, false)
    ])
  else
    return w('loop', [
      w('if', [
        compile(test, false),
        w('then', [compile(iter, true), w('br', [1]) ])
      ]),
      compile(result, true)
      ])
}

exports.set =
exports.def = function ([sym, value], isBlock) {
  return w('local.' +(isBlock ? 'set':'tee'), [$(sym), compile(value, false)])
}

function recurseOp(name) {
  return function recurse (args) {
    if(args.length == 1) return compile(args[0])
    if(args.length == 2)
      return w(name, [compile(args[0]),  compile(args[1]) ])
    return w(name, [compile(args[0]), recurse(args.slice(1))])
  }
}

function pairOp (name) {
  return function ([a, b]) {
    return w(name, [compile(a), compile(b)])
  }
}

function storeOp(name) {
  return function ([ptr, value], isBlock) {
    if(isBlock)
      return w(name, [compile(ptr, false), compile(value, false)])
    else
      //note! this is wrong, it could apply value twice
      //(if it has side effects)
      return w('block', [
        result_i32,
        w(name, [compile(ptr, false), compile(value, false) ]),
        compile(value, false)
      ])
  }
}

function uniOp(name) {
  return function ([value], isBlock) {
    return w(name, [compile(value, isBlock)])
  }
}

exports.add   = recurseOp('i32.add')
exports.sub   = recurseOp('i32.sub')
exports.mul   = recurseOp('i32.mul')
exports.div   = recurseOp('i32.div_s')
exports.and   = recurseOp('i32.and')
exports.or    = recurseOp('i32.or')
exports.mod   = pairOp('i32.rem_s')

exports.lt    = pairOp('i32.lt_s')
exports.lte   = pairOp('i32.le_s')
exports.gt    = pairOp('i32.gt_s')
exports.gte   = pairOp('i32.ge_s')
exports.eq    = pairOp('i32.eq')
exports.neq   = pairOp('i32.ne')
exports.shl   = pairOp('i32.shl')
exports.shr   = pairOp('i32.shr_u')
exports.shr_s = pairOp('i32.shr_s')
exports.xor   = pairOp('i32.xor')
exports.rotl  = pairOp('i32.rotl')
exports.rotr  = pairOp('i32.rotr')

exports.i32_store8  = storeOp('i32.store8')
exports.i32_store16 = storeOp('i32.store16')
exports.i32_store   = storeOp('i32.store')

exports.i32_load8   = uniOp('i32.load8_u')
exports.i32_load16  = uniOp('i32.load16_u')
exports.i32_load    = uniOp('i32.load')

// just a temporary hack!
// instead implement globals that only a module can see...
exports.set_global = function ([v, value]) {
  return w('global.set', [v, compile(value, false)])
}
exports.get_global = function ([v]) {
  return w('global.get', [v])
}

exports.fatal = function ([msg]) {
  //todo: pass message back to user api?
  return w('unreachable')
}
