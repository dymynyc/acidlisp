
//TODO implement enough primitives to do something maybe useful
//eq get_local i32.cont add/sub if call

var {
  isDefined, isSymbol, isArray,
  isDef, isEmpty, isFunction, isNumber, isBound,
  eqSymbol, equals, stringify, traverse
} = require('../util')

function indent (src) {
  return src.split('\n').map(line => '  ' + line).join('\n')
}

function $ (sym) {
  return sym.description[0] == '$' ? sym.description : '$'+sym.description
}

function getFunctions (ast) {
  var funs = []

  ;(function each (tree) {
    if(eqSymbol(tree[0], 'fun')) {
        funs.push(tree)
    }
    if(isFunction(tree)) {
      if(!~funs.indexOf(tree)) {
        funs.push(tree)
        each(tree.source)
      }
    }
    else if(isArray(tree))
      tree.forEach(each)
  })(ast)
  return funs
}

function isFun(f) {
  return isArray(f) && eqSymbol(f[0], 'fun')
}

function getFun (f) {
  if(isFunction (f)) return f.source
  if(eqSymbol(f, 'ref') && isFunction(f[1])) return f[1].source
  if(isFun (f)) return f
  throw new Error('cannot find function:'+stringify(f))
}

function getDefs (ast, defs) {
  defs = defs || {}
  if(isArray(ast) && isDef(ast[0]))
    defs[$(ast[1])] = true
  else if(isArray(ast))
    ast.forEach(a => getDefs(a, defs))
  //console.log("DEFS", defs)
  return Object.keys(defs).map(k => Symbol(k))
}

function compile (ast, funs) {
  //remove refs
  if(isArray(ast) && eqSymbol(ast[0], 'ref')) {
    if(isFunction(ast[1])) ast = ast[2]
    else ast = ast[1]
  }

  if(isArray(ast)) {
    //map strings back to
    var fn_name = ast[0].description
    var fn = exports[fn_name]
    if(fn)
      return fn(ast.slice(1))
    else {
      console.log("FN_NAME", ast[0])
//      fn_name = /^f\d+$/.test(fn_name) ? +fn_name.substring(1) : '$'+fn_name
  
      if(!~(fn_name = funs.indexOf(ast[0]))) 
        throw new Error('could not index function:' + stringify(ast[0]))

      return '(call '+fn_name+' ' + ast.slice(1).map(v => compile(v, funs)).join(' ')+')'
    }
  }
  else if(isNumber(ast))
    return '(i32.const '+ast+')' //TODO other number types
  else if(isSymbol(ast))
    return '(get_local '+ $(ast) + ')'
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

exports = module.exports = function (ast, funs) {
  return compile(ast, funs || [])
}

exports.module = function (ast) {
  var funs = getFunctions(ast)
  return '(module\n  (memory (export "memory") 1)\n' +
    indent(
      funs.map(e => exports.fun(e.slice(1), funs)).join('\n') +
      ast.filter(e => eqSymbol(e[0], 'export')).map(e => {
        if(isSymbol(e[1])) {// named export
          var fun = getFun(e[2])
          var export_name = e[1].description
        }
        else {
          var fun = getFun(e[1])
          var export_name = "main" //default export name if you only export one thing
        }
        var name = isSymbol(fun[1]) ? $(fun[1]) : ''
        return '(export '+ JSON.stringify(export_name) +
          ' (func ' + (name ? name+' ' : funs.indexOf(fun)) + '))\n'
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
        defs.map(d => '(local '+$(d)+' i32)').join('\n')+'\n' +
        compile(body[0], funs)
      )+
    ')\n'
}

exports.if = function ([test, then, e_then], funs) {
  if(e_then)
    return '(if\n' + indent(
      compile(test, funs) + '\n(then '+
      compile(then, funs)+')\n(else '+
      compile(e_then, funs) + ') )\n')
  else
    return '(if\n' + indent(
      compile(test, funs) + '\n(then '+
      compile(then, funs)+' ))\n')

//args.map(e => compile(e, funs)).join('\n')) + ')\n'
}

exports.add = function add (args, funs) {
  if(args.length == 1) return compile(args[0], funs)
  if(args.length == 2)
    return '(i32.add '+compile(args[0], funs) + ' ' + compile(args[1], funs)+')'
  return add([args[0], add(args.slice(1), funs)], funs)
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
exports.block = function (args, funs) {
  return args.map(e => compile(e, funs)).join('\n')
}

exports.def = function ([sym, value], funs) {
  return '(set_local '+$(sym)+' ' + compile(value, funs)+')'
}
