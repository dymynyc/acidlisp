
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

function compile (ast, funs, isBlock) {
  if(isArray(ast)) {
    //map strings back to
    var fn_name = ast[0]
    var fn = exports[fn_name.description]
    if(fn)
      return fn(ast.slice(1), funs, isBlock)
    else {
      var fn_index = isRef(fn_name) ? fromRef(fn_name) : '$'+fn_name.description
      return '(call '+fn_index+' ' + ast.slice(1).map(v => compile(v, funs)).join(' ')+')'
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

exports = module.exports = function (ast, funs, isBlock) {
  return compile(ast, funs || [])
}

function assertRef (r) {
 if(!isRef(r))
    throw new Error('expected function ref:'+stringify(r))
  return r
}

exports.module = function (ast) {
  var funs = getFunctions(ast)
//  var funs = null
  var ref
  return '(module\n' +
   //(memory (export "memory") 1)\n' +
    indent(
      funs.map(e => exports.fun(e.slice(1), funs)).join('\n') +
      ast.filter(e => e[0] === syms.export).map(e => {
        if(isSymbol(e[1]) && e[2]) {// named export
          throw new Error('multiple exports not tested yet')
          ref = assertRef(e[2])
          var export_name = e[1].description
        }
        else {
          ref = assertRef(e[1])
          var export_name = "main" //default export name if you only export one thing
        }
        return '(export '+ JSON.stringify(export_name) +
          ' (func ' + fromRef(ref) + '))\n'
      }).join('\n')
    ) +
  '\n)'
}

exports.fun = function (ast, funs) {
  ast = ast.slice(0)
  var defs = getDefs(ast)
  var name = isSymbol(ast[0]) ? $(ast.shift())+' ' : ''
  var args = ast.shift()
  var body = ast
  return '(func '+name + args.map(e => '(param $'+e.description+' i32)').join(' ') + '(result i32)\n'+
      //TODO: extract local vars from body.
      indent(
          (defs.length ? defs.map(d => '(local '+$(d)+' i32)').join('\n')+'\n' : '') +
          compile(body[0], funs)
        )+
    ')\n'
}

exports.if = function ([test, then, e_then], funs) {
  if(e_then)
    return '(if\n' + indent(
      compile(test, funs) + '\n(then '+
      compile(then, funs, true)+')\n(else '+
      compile(e_then, funs, true) + '))')
  else
    return '(if\n' + indent(
      compile(test, funs, true) + '\n(then '+
      compile(then, funs, true)+'))')

//args.map(e => compile(e, funs)).join('\n')) + ')\n'
}

exports.add = function add (args, funs) {
  if(args.length == 1) return compile(args[0], funs)
  if(args.length == 2)
    return '(i32.add '+compile(args[0], funs) + ' ' + compile(args[1], funs)+')'
  return add([args[0], add(args.slice(1), funs)], funs)
}

exports.sub = function sub (args, funs) {
  if(args.length == 1) return compile(args[0], funs)
  if(args.length == 2)
    return '(i32.sub '+compile(args[0], funs) + ' ' + compile(args[1], funs)+')'
  return sub([args[0], sub(args.slice(1), funs)], funs)
}


exports.and = function and (args, funs) {
  if(args.length == 1) return compile(args[0], funs)
  if(args.length == 2)
    return '(i32.and '+compile(args[0], funs) + ' ' + compile(args[1], funs)+')'
  return and([args[0], and(args.slice(1), funs)], funs)
}
exports.lt = function (args, funs) {
  return '(i32.lt_s '+compile(args[0], funs) + ' ' + compile(args[1], funs)+')'
}
exports.block = function (args, funs, isBlock) {
  return args.map((e,i) => compile(e, funs, true)).join('\n')
}

exports.def = function ([sym, value], funs, isBlock) {
  return '(local.' +(isBlock ? 'set':'tee')+' '+$(sym)+' ' + compile(value, funs)+')'
}

exports.loop = function ([test, iter], funs) {
  //TODO: expand test incase it's got statements
  if(isExpressionTree(test))
    return '(loop (if\n'+
      indent(compile(test, funs, false)+'\n(then\n'+
      indent(compile(iter, funs, true))+'\n(br 1))))')
  else {
    if(!eqSymbol(test[0], 'block'))
      throw new Error('expected block:'+stringify(test))
    test = test.slice()
    var value = test.pop()
    return '(loop\n'+
      indent(
        compile(test, funs, true)+'\n'+
        '(if '+compile(value, funs, false)+
          '(then\n' +
          indent(compile(iter, funs, false) + ' (br 1))))')
      )
  }
}
