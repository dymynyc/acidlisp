var {
  isDefined, isSymbol, isArray,
  isDef, isEmpty, isFunction, isNumber, isBound,
  eqSymbol, equals, stringify
} = require('../util')


function compile (ast) {
  if(isSymbol(ast)) return ast.description
  if(isFunction(ast)) return compile(ast.source)
  if(isArray(ast)) {
    var fn = exports[ast[0].description]
    if(!fn) throw new Error('could not resolve compiler for:'+stringify(ast))
    return fn(ast.slice(1))
  }
  return JSON.stringify(ast) //number, boolean, null, string
}


function indent (src) {
  return src.split('\n').map(line => '  ' + line).join('\n')
}
exports = module.exports = compile

exports.module = function (args) {
  return args.map(compile).join(';\n')
}

exports.export = function (args) {
  if(eqSymbol(args[0], 'def'))
    return '(exports.['+JSON.stringify(args[1].description)+'] = '+compile(args[1]) +')'
  else //export without a name
    return '(module.exports = '+compile(args[0])+')'
}

exports.add = function (args) {
  return '(' + args.map(compile).join(' + ')+')'
}
exports.fun = function (_args) {
  _args = _args.slice(0)
  var name = isSymbol(_args[0]) ? _args.shift() : null
  var args = _args.shift()
  var body = _args
  return ('(function '+(name?name+' ':'') + '('+args.map(compile).join(', ')+') {\n'+
    //todo: extract defs, put them first.
    indent('return ' + compile(body[0])) +
  '\n})')
}
