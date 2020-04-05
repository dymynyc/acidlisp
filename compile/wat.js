
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

function compile (ast) {
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
      fn_name = /^f\d+$/.test(fn_name) ? +fn_name.substring(1) : '$'+fn_name

      return '(call '+fn_name+' ' + ast.slice(1).map(compile).join(' ')+')'
    }
  }
  else if(isNumber(ast))
    return '(i32.const '+ast+')' //TODO other number types
  else if(isSymbol(ast))
    return '(get_local $'+ ast.description + ')'
  else throw new Error('unsupported type:'+stringify(ast))

  //hard coded strings will be encoded in a data section
}

exports = module.exports = compile

exports.module = function (ast) {
  var funs = getFunctions(ast)
  return '(module\n  (memory (export "memory") 1)\n' +
    indent(
      funs.map(e => exports.fun(e.slice(1))).join('\n') +
      ast.filter(e => eqSymbol(e[0], 'export')).map(e => {
        if(isSymbol(e[1])) {// named export
          var fun = getFun(e[2])
          var export_name = e[1].description
        }
        else {
          var fun = getFun(e[1])
          var export_name = "main" //default export name if you only export one thing
        }
        var name = isSymbol(fun[1]) ? fun[1] : ''
        return '(export '+ JSON.stringify(export_name) +
          ' (func ' + (name ? '$'+name+' ' : funs.indexOf(fun)) + '))\n'
      }).join('\n')
    ) +
  '\n)'
}

exports.fun = function (ast) {
  ast = ast.slice()
  var name = isSymbol(ast[1]) ? '$'+ast.shift().description+' ' : ''
  var args = ast.shift()
  var body = ast
  return '(func '+name + args.map(e => '(param $'+e.description+' i32)').join(' ') + '(result i32)\n'+
      //TODO: extract local vars from body.
      indent(compile(body[0]))+
    ')\n'
}

exports.add = function add (args) {
  if(args.length == 1) return compile(args[0])
  if(args.length == 2)
    return '(i32.add '+compile(args[0]) + ' ' + compile(args[1])+')'
  return add([args[0], add(args.slice(1))])
}
