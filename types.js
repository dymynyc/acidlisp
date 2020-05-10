var {parseFun, isSymbol, isArray, isNumber, stringify} = require('./util')
var syms = require('./symbols')

var s = {}
'Int,List,Nil,Bool,Array'
  .split(',')
  .map(v => s[v] = Symbol(v))

function assertTypes(actual, expected, ast) {
  if(actual !== expected) {
    throw new Error(
      'type error, found:' +
      actual.description +
      ', expected:'+expected.description +
      ', at:'+JSON.stringify(ast.meta)
    )
  }
}

function isVar(sym) {
  if(!isSymbol(sym)) return false
  var c = sym.description[0]
  return c === c.toLowerCase()
}

function check(fn, types, _scope) {
  var {name, args, body} = parseFun(fn)
  if(types.length != args.length)
    throw new Error('incorrect number of arguments, expected:'+types.length+', got:'+args.length)
  var scope = {__proto__: _scope}
  for(var i = 0; i < args.length; i++)
    scope[args[i].description] = types[i]

  return (function _check (ast) {
    if(isSymbol(ast)) {
      return scope[ast.description]
    }
    if(isArray(ast)) {
      if(ast[0] === syms.if) {
        var t = _check(ast[1])
        assertTypes(t, s.Bool, ast[1])
        var then = _check(ast[2])
        var elseThen = _check(ast[3])
        return then == elseThen ? then : [then, elseThen]
      }

      else if(ast[0] === syms.def) {
        var v = _check(ast[2])
        //optional: 3rd arg defines type of def?
        if(ast[3]) assertTypes(v, ast[3])
        return scope[ast[1].description] = v
      }

      else if(ast[0] === syms.block) {
        var v
        for(var i = 1; i < ast.length; i++)
          v = _check(ast[i])
        return v
      }

      var argv = ast.slice(1)
      var [arg_types, return_types] = scope[ast[0].description]

      for(var i = 0; i < argv.length; i++) {
        if(isVar(arg_types[i]))
          return scope[arg_types[i].description] = argv[i]
        else {
          var actual = _check(argv[i])
          console.error(actual, arg_types[i], ast)
          assertTypes(actual, arg_types[i], ast)
        }
      }

      return return_types[0]
    }
    else
      return isNumber(ast) ? s.Int : s.Nil
  })(body)
}

exports = module.exports = check
exports.types = s
