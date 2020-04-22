var {
  isDefined, isSymbol, isArray, isBuffer,
  isDef, isFun, isEmpty, isFunction, isNumber, isBound, isString,
  eqSymbol, equals, stringify,
  getFunctions, getStrings,
  isExpressionTree,
  toRef, fromRef, isRef,
  pretty
} = require('../util')
var flatten = require('../flatten')

var wasmString = require('wasm-string')

var syms = require('../symbols')

function isSingleLine(s) {
  return !/\n/.test(s)
}

var line_length = 60
function _w(name, args) {
  var i = args.indexOf('\n')
  var lines = args.split('\n').length
  var close = lines > 20 ? '\n)' : ')'
  if(name.length + args.length < line_length && lines === 1)
    return '(' + name +' ' + args + ')'
  else if(~i && i < line_length/2)
    return '(' + name + ' ' + indent(args).trim() + close
  else
    return '(' + name + '\n' + indent(args) + close
}

function w(name, args) {
  if(isArray(args)) {
    args = args.filter(isDefined)
    var length = args.reduce((sum, a) => sum + a.length, 0)
    return _w(name, args.join(
      args.every(isSingleLine) && length < line_length ? ' ' : '\n'
    ))
  }

  if(!isString(args))
    args = args.toString()

  return _w(name, args)
}

function getDefs (ast, defs) {
  defs = defs || {}
  if(isArray(ast)) {
    if(isDef(ast[0])) {
      defs[$(ast[1])] = true
      if(isArray(ast[2])) {
        return getDefs(ast[2], defs)
      }
    }
    else
      ast.forEach(a => getDefs(a, defs))
  }
  return Object.keys(defs).map(k => Symbol(k))
}

function indent (src) {
  return src.split('\n').map(line => '  ' + line).join('\n')
}

function $ (sym) {
  if(!isSymbol(sym)) throw new Error('expected Symbol, got:'+sym)
  return sym.description[0] == '$' ? sym.description : '$'+sym.description
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
  return isRef(fn_name) ? fromRef(fn_name) : '$'+fn_name.description
}

//TODO: fix this pointers thing
var pointers = []
function compile (ast, isBlock) {
  if(isArray(ast)) {
    //first, check if it's a core method
    var fn_name = ast[0]
    var fn = exports[fn_name.description]
    if(fn) {
      if(!isFunction(fn)) throw new Error('cannot compile:'+fn_name.description)
      return fn(ast.slice(1), isBlock)
    }
    else {
      return w('call', [toName(fn_name)].concat(ast.slice(1).map(e => compile(e, isBlock))) )
    }
  }
  else if(isNumber(ast))
    return w('i32.const', ast) //TODO other number types
  else if(isSymbol(ast))
    return w('local.get', $(ast))
  else
    throw new Error('cannot compile unsupported type:'+stringify(ast))

  //hard coded strings will be encoded in a data section
}

exports = module.exports = function (ast, env) {
  return exports.module(ast, env)
}

function assertRef (r) {
  if(isRef(r)) return r
  else if(isSymbol(r))
    return r
  else
    throw new Error('expected function ref:'+stringify(r))
}

function getLiterals (ast) {
  for(var i = 0; i < ast.length; i++) {
    if(isDef(ast[i][0]) && eqSymbol(ast[i][1], '$LITERALS$'))
      return literals = ast[i][2].slice(1) //slice to remove [list,...]
  }
  return []
}

exports.module = function (ast, env) {
  var funs = getFunctions(ast)
  var literals = getLiterals(ast)
  var ptr = 0, free = 0
  pointers = []
  env = env || {}
  var free, data
  var memory = env.memory
  if(env.globals) free = env.globals[0]
  if(memory)      data = memory.slice(0, free)

  free = ptr //where the next piece of data should go
  var ref
  return w('module', ['\n',
    w('import', ['"system"',  '"log"',
      w('func', ['$sys_log',
        w('param', ['i32']), w('result', ['i32'])
      ])]),
    memory && w('memory', [w('export', '"memory"'), 1]),
    //a global variable that points to the start of the free data.
    //data, literals (strings so far)
    env.globals && w('global', ['$FREE', w('mut', 'i32'), compile(free)]),
    data &&
    w('data',
      [0, w('offset', compile(0)), wasmString.encode(data)]
    ) +'\n'|| '',

    //functions
    funs.map((e, i) => exports.fun(e.slice(1))).join('\n\n') + '\n',

    //exports
    ast.filter(e => e[0] === syms.export).map(e => {
      if(isSymbol(e[1]) && e[2]) {// named export
        ref = assertRef(e[2])
        var export_name = e[1].description
        return w('export', [JSON.stringify(export_name), w('func', toName(ref))])
      }
      else {
        ref = assertRef(e[1])
        var export_name = "main" //default export name if you only export one thing
      }
      return w('export', [JSON.stringify(export_name), w('func', toName(ref))])
    }).join('\n')
  ])
}

exports.fun = function (ast) {
  ast = ast.slice(0)
  var name = isSymbol(ast[0]) ? $(ast.shift()) : ''
  var args = ast.shift()
  var body = flatten(ast[0])
  var defs = getDefs(body)
  return w('func', [name,
    args.map(e => w('param', ['$'+e.description, 'i32']))
    .join(' ') + ' ' + w('result', 'i32'),
    //TODO: extract local vars from body.
    (defs.length ? defs.map(d => '(local '+$(d)+' i32)').join('\n') : ''),
    compile(body, false)
  ])
}

exports.if = function ([test, then, e_then]) {
  if(e_then)
    return w('if', [
      compile(test),
      w('then', compile(then, true)),
      w('else', compile(e_then, true))
    ])
  else
    return w('if', [
      compile(test),
      w('then', compile(then, true))
    ])

}

//XXX apply steps like this in a special pass, before flattening.
//applies to most functions and also if

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

exports.add = recurseOp('i32.add')
exports.sub = recurseOp('i32.sub')
exports.mul = recurseOp('i32.mul')
exports.div = recurseOp('i32.div_s')
exports.and = recurseOp('i32.and')
exports.or  = recurseOp('i32.or')
exports.mod = pairOp('i32.rem_s')

exports.lt  = pairOp('i32.lt_s')
exports.lte = pairOp('i32.le_s')
exports.gt  = pairOp('i32.gt_s')
exports.gte = pairOp('i32.ge_s')
exports.eq  = pairOp('i32.eq')
exports.neq = pairOp('i32.ne')

exports.block = function (args, isBlock) {
  if(isBlock === undefined) throw new Error('isBlock is undefined')
  return args.map((e,i) => {
    //TODO: implement proper globals, and remove that set_ hack
    if(i+1 < args.length) {
      if(!e) return ''
      if(isArray(e) && !syms[e[0].description] && !/^set_/.test(e[0].description) && isExpressionTree(e)) {
        return w('drop', compile(e, true))
      }
     else return compile(e, true)
    }
    return compile(e, isBlock)
  }).join('\n')
}

exports.set =
exports.def = function ([sym, value], isBlock) {
  return w('local.' +(isBlock ? 'set':'tee'), [$(sym), compile(value, false)])
}

exports.loop = function ([test, iter], isBlock) {
  //TODO: expand test incase it's got statements
  if(isExpressionTree(test))
    return '(loop (if\n'+
      indent(compile(test, false)+'\n(then\n'+
      indent(compile(iter, true))+'\n(br 1))))')
  else {
    if(!eqSymbol(test[0], 'block'))
      throw new Error('expected block:'+stringify(test))
    test = test.slice()
    var value = test.pop()
    return '(loop\n'+
      indent(
        compile(test, true)+'\n'+
        '(if '+compile(value, false)+
          '\n(then\n' +
          indent(compile(iter, false))+ '\n(br 1)\n))'
      ) + '\n)'
  }
}

exports.i32_load = function ([ptr]) {
  return w('i32.load', compile(ptr))
}
exports.i32_store = function ([ptr, value]) {
  return w('i32.store', [compile(ptr), compile(value)])
}
exports.i32_load8 = function ([ptr]) {
  return w('i32.load8_u', compile(ptr))
}
exports.i32_store8 = function ([ptr, value]) {
  return w('i32.store8', [compile(ptr), compile(value)])
}
// just a temporary hack!
// instead implement globals that only a module can see...
exports.set_global = function ([index, value]) {
  return w('global.set', [index, compile(value)])
}
exports.get_global = function ([index, value]) {
  return w('global.get', index)
}

exports.fatal = function ([msg]) {
  //todo: pass message back to user api?
  return '(unreachable)'
}

exports.log = function ([ptr]) {
  return w('call', ['$sys_log', compile(ptr)])
}
