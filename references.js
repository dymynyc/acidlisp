var syms = require('./symbols')
var {stringify, isArray, isSymbol, isNumber} = require('./util')

var count = 0

//traverse a freshly parsed ast and map all the references.
//this updates the tree so that shared symbols are in the right
//place.

module.exports = function (ast, _scope) {
  var refs = new Map()
  var scope_id = new Map()
  var scope = {__proto__: _scope}
  scope_id.set(scope, 0)
  function newVar (scope, name, value, mut, arg) {
    scope[name.description] = name
    refs.set(name, {
      value: value,
      mut: !!mut,
      arg: isNumber(arg) ? arg : null,
      scope: scope_id.get(scope),
      id: ++count
    })
  }

  ;(function R (ast, scope, inQuote) {
    if(isArray(ast)) {
      for(var i = 0; i < ast.length; i++) {
        var sym = ast[i]
        if(isSymbol(sym)) {
          //track quotedness, to avoid creating new symbols
          //if there is a quoted fun/mac definition.
          if(sym === syms.quote) {
            if(ast.length != 2) throw new Error('quote must contain just one item')
            inQuote = true
          }
          else if(sym === syms.unquote) {
            if(ast.length !== 2) throw new Error('unquote must contain just one item')
            inQuote = false
          }

          if(syms[sym.description] === sym) { //it's core, do nothing
            if(!refs.get(sym))
              refs.set(sym, {core: true, value: null, mut: false, scope: -1, id: ++count})
          }
          else if(scope[sym.description]) {
            ast[i] = scope[sym.description]
          } else {
            //a new symbol
            scope[sym.description] = sym
            refs.set(sym, {value: null, mut: true, scope: scope_id.get(scope), id: ++count}) //type???
          }
        }
        else if(isArray(ast[i])) {
          var ary = ast[i]
          if(!inQuote && (ary[0] === syms.fun || ary[0] === syms.mac)) {
            if(!refs.get(ary[0]))
              refs.set(ary[0], {core: true, value: null, mut: false, id: ++count})
            var name, args, body
            var _scope = {__proto__: scope} //include parent scope?
            scope_id.set(_scope, scope_id.get(scope) + 1)
            if(isSymbol(ary[1])) {
              name = ast[1]
              newVar(_scope, name, ast, false)
              args = ary[2]
              body = ary[3]
            }
            else {
              args = ary[1]
              body = ary[2]
            }

            for(var j = 0; j < args.length; j++) {
              newVar(_scope, args[j], undefined, false, j)
            }
            R(body, _scope, false)
          }
          else {
            R(ast[i], scope, inQuote)
          }
        }
        else
          console.log('not a ref, must be literal:', ast)
      }
    }
    else
      throw new Error('expected array')
  }(ast, scope, false))
  return refs
}

function indent (s) {
  return s.split('\n').map(line => '  ' + line).join('\n')
}

module.exports.dump = function dump (ast, refs) {
  if(isArray(ast))
    return '(\n'+ indent(ast.map(a => dump(a, refs)).join('\n')) + '\n)'
  else if(isSymbol(ast))
    return ast.description + ' => ' + JSON.stringify(refs.get(ast))
  else
    return stringify(ast)
}
