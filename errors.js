var {
  isSymbol, isFun, isBasic, isFunction, isArray, isObject, isNumber,
  isMac, isDefined, parseFun,pretty,
  stringify, meta, dump
} = require('./util')

function toName(name) {
  return name = isSymbol(name) ? name.description : stringify(name)
}

function toPosition(name, meta) {
  name = toName(name)
  return !meta ? '' :
    '    at ' +name+' ('+meta.filename+':'+meta.line+':'+meta.column+')'
}

var many = [0, Infinity]
var more = [1, Infinity]
var lengths = {
  loop    : [2, 3],
  if      : [2,3],
  def     : 2,
  block   : many,
  and     : more,
  or      : more,
  def     : 2,
  set     : 2,
  export  : [1, 2],
  import  : 1,
  get     : more,
  quote   : 1,
  unquote : 1
}

exports.checkArity = function (ast) {
  if(!isArray(ast) || !isSymbol(ast[0])) return
  var name = ast[0].description
  var length = lengths[name]
  if(!length) return
  var a_length = ast.length-1
  var pos =  toPosition(ast[0], ast.meta)

  if(isNumber(length))
    if(length !== a_length) throw new Error(
      'incorrect number of arguments for:' + name +
      ', expected:'+length+', got:' + a_length + '\n' + pos
    )
  else if(length[0] > a_length)
    throw new Error(
      'incorrect number of arguments for:' + name +
      ', expected at least:'+length[0]+', got:' + a_length +
      ' at '+JSON.stringify(ast.meta) + '\n' + pos
    )
  else if(length[1] < a_length)
    throw new Error(
      'incorrect number of arguments for:' + name +
      ', expected at most:'+length[1]+', got:' + a_length + '\n' + pos
    )

}


exports.assertArgs = function (fn, argv) {
  var type = fn[0], name = fn[1], args = fn[2], body = fn[3]
  if(isArray(args))
    if(args.length != argv.length)
      throw new Error(
        toName(type) + ' ' +toName(name||'') +' expected '+
          args.length + ' but got:'+argv.length + '\n' +
        'defined as:' +stringify([type, name, args]) + '\n' + 
        'but passed:'+ pretty(argv)
      )
}


var stack = []

exports.wrap = function wrap (fn, trace) {
  return function () {
    var args = [].slice.call(arguments), pushed
    if(trace && args[0].meta) {
      var pushed = true
      stack.push(args[0])
    }
    try {
      var r = meta(args[0], fn.apply(null, args))
      if(trace && pushed) stack.pop()
      return r
    } catch (err) {
      if(err.acid) throw err
      err = exports.addAcidStackTrace(args[0], err)
      if(trace && pushed) stack.pop()
      throw err
    }
  }
}

exports.addAcidStackTrace = function (ast, err) {
  err.message =
    'AcidError: ' + err.message + '\n' +
      (stack.length ? stack.slice() : [ast])
      .reverse().slice(0, 20)
        .map((e) => 
          e && e.meta && toPosition(e[0], e.meta)
        ).filter(Boolean).join('\n')+
      '\nJavaScriptError:'
  err.acid = true
  return err
}
