var {
  isDefined, isSymbol, isArray, isBuffer,
  isDef, isFun, isEmpty, isFunction, isNumber, isBound, isString,
  eqSymbol, equals, stringify, traverse,
  getFunctions, getStrings,
  isExpressionTree,
  toRef, fromRef, isRef
} = require('../util')
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
    args.filter(Boolean)
    var length = args.reduce((sum, a) => sum + a.length, 0)
    return _w(name, args.join(
      args.every(isSingleLine) && length < line_length ? ' ' : '\n'
    ))
  }

  if(!isString(args))
    args = args.toString()

  return _w(name, args)
}

function isLiteral (ast) {
  return (
    isArray(ast) &&
    ast[0] === syms.get &&
    eqSymbol(ast[1], '$LITERALS$')
  )
}

function getDefs (ast, defs) {
  defs = defs || {}
  if(isArray(ast) && isDef(ast[0]))
    defs[$(ast[1])] = true

  else if(isLiteral(ast))
    ; //ignore literals
  else if(isArray(ast))
    ast.forEach(a => getDefs(a, defs))
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

//TODO: fix this pointers thing
var pointers = []
function compile (ast, isBlock) {
  if(isLiteral(ast)) {
    return compile(pointers[ast[2]], false)
  }
  else if(isArray(ast)) {
    //first, check if it's a core method
    var fn_name = ast[0]
    var fn = exports[fn_name.description]
    if(fn) {
      if(!isFunction(fn)) throw new Error('cannot compile:'+fn_name.description)
      return fn(ast.slice(1), isBlock)
    }
    else {
      var fn_index = isRef(fn_name) ? fromRef(fn_name) : '$'+fn_name.description
      return w('call', [fn_index].concat(ast.slice(1).map(compile)) )
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

exports = module.exports = function (ast, isBlock) {
  return compile(ast)
}

function assertRef (r) {
 if(!isRef(r))
    throw new Error('expected function ref:'+stringify(r))
  return r
}

function getLiterals (ast) {
  for(var i = 0; i < ast.length; i++) {
    if(isDef(ast[i][0]) && eqSymbol(ast[i][1], '$LITERALS$'))
      return literals = ast[i][2].slice(1) //slice to remove [list,...]
  }
  return []
}

exports.module = function (ast) {
  var funs = getFunctions(ast)
  var literals = getLiterals(ast)
  var ptr = 0, free = 0
  pointers = []
  var data = literals.map(function (e) {
    pointers.push(ptr)
    var b = Buffer.alloc(4)
    b.writeUInt32LE(e.length, 0)
    ptr += 4 + e.length
    return [b, e]
  })
  free = ptr //where the next piece of data should go
  var ref
  return w('module', ['\n',
    w('memory', [w('export', '"memory"'), 1]),
    //a global variable that points to the start of the free data.

    //data, literals (strings so far)
    w('global', ['$FREE', w('mut', 'i32'), compile(free)]),
    data.length &&
    w('data',
      [0, w('offset', compile(0))].concat(
      data.map((e, i) =>
        toHex(e[0]) + '\n' +
        ' ;; ptr='+pointers[i] + ', len=' + e[0].readUInt32LE(0) + '\n' +
        wasmString.encode(e[1]))
      ).join('\n')
    ) + '\n' || '',

    //functions
    funs.map((e, i) => exports.fun(e.slice(1))).join('\n\n') + '\n',

    //exports
    ast.filter(e => e[0] === syms.export).map(e => {
      if(isSymbol(e[1]) && e[2]) {// named export
        ref = assertRef(e[2])
        var export_name = e[1].description
        return w('export', [JSON.stringify(export_name), w('func', fromRef(ref))])
      }
      else {
        ref = assertRef(e[1])
        var export_name = "main" //default export name if you only export one thing
      }
      return w('export', [JSON.stringify(export_name), w('func', fromRef(ref))])
    }).join('\n')
  ])
}

exports.fun = function (ast) {
  ast = ast.slice(0)
  var defs = getDefs(ast)
  var name = isSymbol(ast[0]) ? $(ast.shift()) : ''
  var args = ast.shift()
  var body = ast
  return w('func', [name,
    args.map(e => w('param', ['$'+e.description, 'i32']))
    .join(' ') + ' ' + w('result', 'i32'),
    //TODO: extract local vars from body.
    (defs.length ? defs.map(d => '(local '+$(d)+' i32)').join('\n') : ''),
    compile(body[0])
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

exports.add = recurseOp('i32.add')
exports.sub = recurseOp('i32.sub')
exports.mul = recurseOp('i32.mul')
exports.div = recurseOp('i32.div_s')
exports.and = recurseOp('i32.and')
exports.or  = recurseOp('i32.or')

function pairOp (name) {
  return function ([a, b]) {
    return w(name, [compile(a), compile(b)])
  }
}

exports.lt  = pairOp('i32.lt_s')
exports.lte = pairOp('i32.le_s')
exports.gt  = pairOp('i32.gt_s')
exports.gte = pairOp('i32.ge_s')
exports.eq  = pairOp('i32.eq')
exports.neq = pairOp('i32.ne')

exports.block = function (args, funs, isBlock) {
  return args.map((e,i) => {
    if(i+1 < args.length && isArray(e) && isSymbol(e[0]) && /^\$/.test(e[0].description))
      return w('drop', compile(e, true))
    return compile(e, true)
  }).join('\n')
}

exports.def = function ([sym, value], isBlock) {
  return w('local.' +(isBlock ? 'set':'tee'), [$(sym), compile(value)])
}

exports.loop = function ([test, iter], funs) {
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
          '(then\n' +
          indent(compile(iter, false) + ' (br 1))))')
      )
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
