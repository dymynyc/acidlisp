var {
  isDefined, isSymbol, isArray,
  isDef, isEmpty, isFunction, isNumber, isBound,
  eqSymbol, equals, stringify, parseFun
} = require('../util')

function getDefs (ast, defs) {
  defs = defs || {}
  if(isArray(ast) && isDef(ast[0]))
    defs[ast[1].description] = true
  else if(isArray(ast))
    ast.forEach(a => getDefs(a, defs))
  return Object.keys(defs)
}

function compile (ast) {
  if(isSymbol(ast)) return ast.description

  if(isArray(ast)) {
    var fn = exports[ast[0].description]
//    if(!fn) throw new Error('could not resolve compiler for:'+stringify(ast))
    if(fn)
      return fn(ast.slice(1))
    //else it must be a call to a fn we've defined
    else
      return ast[0].description + '(' + ast.slice(1).map(compile).join(', ')+')'
  }
  return JSON.stringify(ast) //number, boolean, null, string
}


function indent (src) {
  return src.split('\n').map(line => '  ' + line).join('\n')
}
exports = module.exports = function (ast) {
  return (
    '(function () {' +
      'var module = {exports: {}}, exports = module.exports;'+
      compile(ast)+
      ';return module.exports;})()'
  )
}

exports.if = function ([test, then, else_then]) {
  return '(' +
    compile(test) +' ? ' +
    compile(then) + ' : ' +
    (isDefined(else_then) ? compile(else_then) : 'null') +
  ')'
}

exports.module = function (args) {
  var defs = getDefs(args)
  return '(function () {\n' +
    'var memory = Buffer.alloc(65536);\n' +
    (defs.length ? 'var ' + defs.join(', ') + ';\n' : '') +
    args.map(compile).join(';\n') + '})();'
}

exports.export = function (args) {
  if(isSymbol(args[0]) && args[1])
    return '(exports['+JSON.stringify(args[0].description)+'] = '+compile(args[1]) +')'
  else //export without a name
    return '(module.exports = '+compile(args[0])+')'
}

exports.block = function (args) {
  return '(' + args.map(compile).join(', ') + ')'
}

exports.def = function ([key, value]) {
  return '(' + key.description +' = ' + compile(value) + ')'
}

exports.fun = function (_args) {
  _args = _args.slice(0)
  var name, args, body
  if(isSymbol(_args[0]))
    name = _args[0], args = _args[1], body = _args[2]
  else
    name = null, args = _args[0], body = _args[1]

  var defs = getDefs(body)
  return ('(function '+(name?name.description+' ':'') + '('+args.map(compile).join(', ')+') {\n'+
    //todo: extract defs, put them first.
    (defs.length ? 'var ' + defs.join(', ') + ';\n' : '') +
    indent('return ' + compile(body)) +
  '\n})')
}

exports.loop = function ([test, body]) {
  return '(function () {'+
    'var result = null; while('+compile(test)+'){result ='+compile(body)+'} return result;\n'+
  '})()'
}

exports.i32_store = function ([ptr, value]) {
  return '(memory.writeInt32LE('+compile(value)+', '+compile(ptr)+'),' + compile(value)+')'
}
exports.i32_load = function ([ptr]) {
  return 'memory.readInt32LE('+compile(ptr)+')'
}

exports.add = function (args) {
  return '(' + args.map(compile).join(' + ')+')'
}
exports.sub = function (args) {
  return '(' + args.map(compile).join(' - ')+')'
}
exports.mul = function (args) {
  return '(' + args.map(compile).join(' * ')+')'
}
exports.div = function (args) {
  return '(' + args.map(compile).join(' / ')+')'
}
exports.and = function (args) {
  return '(' + args.map(compile).join(' & ')+')'
}
exports.or = function (args) {
  return '(' + args.map(compile).join(' | ')+')'
}
exports.lt = function ([a, b]) {
  return '(' + compile(a) + ' < ' + compile(b) +')'
}
exports.lte = function ([a, b]) {
  return '(' + compile(a) + ' <= ' + compile(b) +')'
}
exports.gt = function ([a, b]) {
  return '(' + compile(a) + ' > ' + compile(b) +')'
}
exports.gte = function ([a, b]) {
  return '(' + compile(a) + ' >= ' + compile(b) +')'
}
exports.list = function (args) {
  return '[' + args.map(compile).join(', ') + ']'
}
