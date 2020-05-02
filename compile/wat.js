var {
  isDefined, isSymbol, isArray, isBuffer,
  isDef, isFun, isEmpty, isFunction, isNumber, isBound, isString,
  isSystemFun, readBuffer,
  eqSymbol, equals, stringify,
  getFunctions, getStrings,
  isExpressionTree,
  toRef, fromRef, isRef,
  pretty
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
    if(!isSymbol(fn_name))
      throw new Error('name is non-symbol:'+pretty(ast) + ' at:'+JSON.stringify(ast.meta))
    var fn = exports[fn_name.description]
    if(fn) {
      if(!isFunction(fn)) throw new Error('cannot compile:'+fn_name.description)
      return fn(ast.slice(1), isBlock)
    }
    else {
      return w('call', [toName(fn_name)].concat(ast.slice(1).map(e => compile(e, false))) )
    }
  }
  //the following values can't do anything in a block position
  else if(isBlock)
    return ''
  else if(isNumber(ast))
    return w('i32.const', ast) //TODO other number types
  else if(isSymbol(ast))
    return w('local.get', $(ast))
  else if(ast === null) return compile(0)
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

//function getLiterals (ast) {
//  for(var i = 0; i < ast.length; i++) {
//    if(isDef(ast[i][0]) && eqSymbol(ast[i][1], '$LITERALS$'))
//      return literals = ast[i][2].slice(1) //slice to remove [list,...]
//  }
//  return []
//}
//
exports.module = function (ast, env) {
  var imports = getImports(ast)
  var funs = getFunctions(ast)
//  var literals = getLiterals(ast)
  var ptr = 0, free = 0
  pointers = []
  env = env || {}
  var free, data
  var memory = env.memory
  if(env.globals) free = env.globals[0]
  if(memory)      data = memory.slice(0, free)

  free = ptr //where the next piece of data should go
  var ref
  return w('module\n', [
    (imports.length ?
      imports.map(e => exports.system_fun(e, env))
      .join('\n'): '') + '\n',
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
  var body = ast[0]
  var defs = getDefs(body)
  return w('func', [name,
    args.map(e => w('param', ['$'+e.description, 'i32']))
    .join(' ') + ' ' + w('result', 'i32'),
    //TODO: extract local vars from body.
    (defs.length ? defs.map(d => '(local '+$(d)+' i32)').join('\n') : ''),
    compile(body, false)
  ])
}

exports.system_fun = function (ast, env) {
  var name = ast[1]
  var fun = ast[2]
  var module = wasmString.encode(readBuffer(env.memory, fun[3][0]))
  var m_name = wasmString.encode(readBuffer(env.memory, fun[3][1]))
  var params = fun[2]
  return w('import', [module, m_name,
    w('func', [$(name), params.map(e => w('param', 'i32'))
      .concat(w('result', 'i32')).join(' ')])
  ])

}

exports.if = function ([test, then, e_then], isBlock) {
  if(e_then)
    return w('if', [
      isBlock ? '' : w('result', 'i32'),
      compile(test, false),
      compile(then, isBlock),
      compile(e_then, isBlock)
    ])
  else
    return w('if', [
      isBlock ? '' : w('result', 'i32'),
      compile(test, false),
      compile(then, isBlock),
      isBlock ? '' : compile(0, isBlock)
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

exports.block = function (args, isBlock) {
  if(isBlock === undefined) throw new Error('isBlock is undefined')
  return w('block ' + (isBlock ? '' : '(result i32)'), args.map((e,i) => {
    //TODO: implement proper globals, and remove that set_ hack
    if(i+1 < args.length) {
      if(!e) return ''
      if(
        isArray(e) &&
        !syms[e[0].description] &&
        !/^set_/.test(e[0].description) &&
        isExpressionTree(e)
      ) {
        return w('drop', compile(e, true))
      }
      else
        return compile(e, true)
    }
    //can drop lone variables, at the end of blocks,
    //if that block does not need a value.
    return isBlock && isSymbol(e) ? '' :compile(e, isBlock)
  }))
}

exports.set =
exports.def = function ([sym, value], isBlock) {
  return w('local.' +(isBlock ? 'set':'tee'), [$(sym), compile(value, false)])
}

exports.loop = function ([test, iter, result], isBlock) {
  if(!isBlock)
    return '(loop (result i32) (if (result i32)\n'+
      indent(
        compile(test, false)+ ';;test \n(then\n'+
          indent(compile(iter, false)+ ';;body\n'+
          '(br 1))\n' +
            compile(result || 0, false)+';;result\n'+
          '))')
      )
  else
    return '(loop (if\n'+
      indent(
        //note: test for an if must always return a value
        compile(test, false)+ '\n(then\n'+
          indent(compile(iter, true)+ '\n'+
          '(br 1))\n' +
          (result ? compile(result, true) : '')+
          '))')
      )

}

exports.i32_load = function ([ptr]) {
  return w('i32.load', compile(ptr))
}
exports.i32_store = function ([ptr, value], isBlock) {
  if(isBlock)
    return w('i32.store', [compile(ptr, false), compile(value, false)])
  else
    //note! this is wrong, it could apply value twice
    //(if it has side effects)
    return w('block (result i32)',
      [w('i32.store', [compile(ptr, false), compile(value, false)]),
      compile(value, false)])


}
exports.i32_load8 = function ([ptr]) {
  return w('i32.load8_u', compile(ptr))
}
exports.i32_store8 = function ([ptr, value], isBlock) {
  if(isBlock)
    return w('i32.store8', [compile(ptr), compile(value)])
  else
    //note! this is wrong, it could apply value twice
    //(if it has side effects...)
    //instead we need to add another variable to hold this then return.
    //if value is already a variable, that's fine.
    return w('block (result i32)',
      [w('i32.store8', [compile(ptr), compile(value)]), compile(value)])
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
