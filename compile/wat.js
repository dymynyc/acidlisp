
//TODO implement enough primitives to do something maybe useful
//eq get_local i32.cont add/sub if call

var {
  isDefined, isSymbol, isArray,
  isDef, isEmpty, isFunction, isNumber, isBound,
  eqSymbol, equals, stringify, traverse,
  isExpressionTree,
  toRef, fromRef, isRef
} = require('../util')

var syms = require('../symbols')

function getDefs (ast, defs) {
  defs = defs || {}
  if(isArray(ast) && isDef(ast[0]))
    defs[$(ast[1])] = true
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

function isFun(f) {
  return isArray(f) && eqSymbol(f[0], 'fun')
}

function getFun (f, message) {
  if(isFunction (f)) return f.source
  if(isFun (f)) return f
  throw new Error('cannot find function:'+stringify(f)+ ' ' + (message || ''))
}

function compile (ast, isBlock) {
  if(isArray(ast)) {
    //first, check if it's a core method
    var fn_name = ast[0]
    var fn = exports[fn_name.description]
    if(fn)
      return fn(ast.slice(1), isBlock)
    else {
      var fn_index = isRef(fn_name) ? fromRef(fn_name) : '$'+fn_name.description
      return '(call '+fn_index+' ' + ast.slice(1).map(v => compile(v)).join(' ')+')'
    }
  }
  else if(isNumber(ast))
    return '(i32.const '+ast+')' //TODO other number types
  else if(isSymbol(ast))
    return '(local.get '+ $(ast) + ')'
  else throw new Error('unsupported type:'+stringify(ast))

  //hard coded strings will be encoded in a data section
}

function getFunctions (tree, funs) {
  funs = funs || []
  ;(function maybe(fn) {
    if(isArray(fn) && eqSymbol(fn[0], 'fun') && !~funs.indexOf(fn)) {
      funs.push(fn)
      maybe(isSymbol(fn[1]) ? fn[3] : fn[2])
    }
    else if(isArray(fn))
      fn.forEach(maybe)
  })(tree)
  return funs
}

exports = module.exports = function (ast, isBlock) {
  return compile(ast)
}

function assertRef (r) {
 if(!isRef(r))
    throw new Error('expected function ref:'+stringify(r))
  return r
}

exports.module = function (ast) {
  var funs = getFunctions(ast)
  var ref
  return '(module\n' +
    indent(
      '(memory (export "memory") 1)\n\n' +
      funs.map(
        (e, i) => //';; func '+i + '\n' +
              exports.fun(e.slice(1))
      ).join('\n') +
      '\n'+
      ast.filter(e => e[0] === syms.export).map(e => {
        if(isSymbol(e[1]) && e[2]) {// named export
          ref = assertRef(e[2])
          var export_name = e[1].description
          return '(export '+ JSON.stringify(export_name) +
          ' (func ' + fromRef(ref) + '))'
        }
        else {
          ref = assertRef(e[1])
          var export_name = "main" //default export name if you only export one thing
        }
        return '(export '+ JSON.stringify(export_name) +
          ' (func ' + fromRef(ref) + '))'
      }).join('\n')
    ) +
  '\n)'
}

exports.fun = function (ast) {
  ast = ast.slice(0)
  var defs = getDefs(ast)
  var name = isSymbol(ast[0]) ? $(ast.shift())+' ' : ''
  var args = ast.shift()
  var body = ast
  return '(func '+name + args.map(e => '(param $'+e.description+' i32)').join(' ') + '(result i32)\n'+
      //TODO: extract local vars from body.
      indent(
          (defs.length ? defs.map(d => '(local '+$(d)+' i32)').join('\n')+'\n' : '') +
          compile(body[0])
        )+
    ')\n'
}

exports.if = function ([test, then, e_then]) {
  if(e_then)
    return '(if\n' + indent(
      compile(test) + '\n(then '+
      compile(then, true)+')\n(else '+
      compile(e_then, true) + '))')
  else
    return '(if\n' + indent(
      compile(test, true) + '\n(then '+
      compile(then, true)+'))')
}

//XXX apply steps like this in a special pass, before flattening.
//applies to most functions and also if
exports.add = function add (args, funs) {
  if(args.length == 1) return compile(args[0])
  if(args.length == 2)
    return '(i32.add '+compile(args[0]) + ' ' + compile(args[1])+')'
  return add([args[0], add(args.slice(1))])
}

exports.sub = function sub (args) {
  if(args.length == 1) return compile(args[0])
  if(args.length == 2)
    return '(i32.sub '+compile(args[0]) + ' ' + compile(args[1])+')'
  return sub([args[0], sub(args.slice(1))])
}

exports.mul = function mul (args, funs) {
  if(args.length == 1) return compile(args[0])
  if(args.length == 2)
    return '(i32.mul '+compile(args[0]) + ' ' + compile(args[1])+')'
  return mul([args[0], mul(args.slice(1))])
}
exports.div = function div (args, funs) {
  if(args.length == 1) return compile(args[0])
  if(args.length == 2)
    return '(i32.div_s '+compile(args[0]) + ' ' + compile(args[1])+')'
  return div([args[0], div(args.slice(1))])
}

exports.and = function and (args) {
  if(args.length == 1) return compile(args[0])
  if(args.length == 2)
    return '(i32.and '+compile(args[0]) + ' ' + compile(args[1])+')'
  return and([args[0], and(args.slice(1))], funs)
}
exports.lt = function (args) {
  return '(i32.lt_s '+compile(args[0]) + ' ' + compile(args[1])+')'
}
exports.block = function (args, funs, isBlock) {
  return args.map((e,i) => compile(e, true)).join('\n')
}

exports.def = function ([sym, value], isBlock) {
  return '(local.' +(isBlock ? 'set':'tee')+' '+$(sym)+' ' + compile(value)+')'
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

var ops = {
  'i32.load': [1],
  'i32.store': [2, 2]
}
exports.i32_load = function ([ptr]) {
  return '(i32.load '+compile(ptr)+')'
}
exports.i32_store = function ([ptr, value]) {
  return '(i32.store '+compile(ptr)+' ' + compile(value)+')'
}

////module.exports = function (compile, exports) {
//  for(var k in ops) (function (key, arity) {
//    exports[k.replace(/\./g, '_')] = function  (args) {
//      if(args.length != arity)
//        throw new Error('wasm operation:'+key+' expects '+ arity +
//          ' arguments, got:'+args.length+', '+(stringify(args)))
//      return '('+k+' '+args.map(compile).join(' ')+')'
//    }
//  })(k, ops[k])
//
////}
