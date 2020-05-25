var assert = require('assert')
var syms = require('./symbols')
var lookup = require('./lookup')
var internal = require('./internal')
var errors = require('./errors')
var {
  isSymbol, isBasic, isDefined, isFunction, isArray, isLookup,
  isCore, isNumber, isFun: _isFun, isBoundFun, isSystemFun, stringify, parseFun
} = require('./util')

function isFun(f) {
  return _isFun(f) || isBoundFun(f)
}

//copied from eval (might move it to lookup.js)
function createScope(fn, map, _scope) {
  var {name, args, body} = parseFun(fn)
  var scope = {__proto__: _scope || {}}
  if(isArray(map)) {
    errors.assertArgs(fn, map)
    var ary = map; map = (_,i) => ary[i]
  }
  for(var i = 0; i < args.length; i++)
    scope[args[i].description] = {value: map(args[i], i)}
  if(name)
    scope[name.description] = {value: fn}
  return scope
}

function isRecursive (fn) {
  var {name, body} = parseFun(fn)
  //can't be recursive if it does not refer to itself.
  return name ? !!(function R (ast) {
    if(isSymbol(ast) && ast.description === name.description) return true
    else if(isArray(ast)) return ast.find(R)
  })(body) : false
}

function calls (ast, name) {
  return isArray(ast) && isSymbol(ast[0]) && ast[0].description === name.description
}

function isLoopifyable (fn) {
  var {name, args, body} = parseFun(fn)
  return (
    isRecursive(fn) && isSymbol(name) && isArray(body) &&
    body[0] === syms.if && !calls(body[1], name) &&
    (calls(body[2], name) ^ calls(body[3], name))
  )
}

function scopify (expr) {
  if(isArray(expr)) {
    if(expr[0] === syms.scope) return expr
    if(expr[0] === syms.block) return [syms.scope].concat(expr.slice(1))
  }
  return (function R (expr) {
    return isArray(expr) && (syms.def === expr[0] ? true : expr.find(R))
  })(expr) ? [syms.scope, expr] : expr
}


function blockify (args, argv, result) {
  return [syms.block]
    .concat(args.map((k, i) => [syms.def, k, argv[i]]))
    .concat(result ? [result] : [])
}

function create_loop(args, argv, test, recurse, result) {
  var r = scopify(blockify(args, argv,
    [syms.loop, test, blockify(args, recurse), result]))

  return r
}

var eqz = Symbol('eqz')

function loopify(fn, argv, scope) {
  var hygene = 1
  var {name, args, body} = parseFun(fn)

  var [_if, test, result, recurse] = body
  assert.ok(_if === syms.if)

  //check if the test expression can be evaled,
  //if so, unroll the recursion.
  var _inline = a => {
    return inline_expr(a, scope, fn, hygene)
  }

  var _scope = createScope(fn, argv, scope)
  var r = inline_expr(test, _scope, fn, hygene)
  if(isBasic(r)) {
    return inline_expr(r ? result : recurse, _scope, fn, hygene)
  }

  //else, make sure we don't override the parameters!
  //(doesn't work without this...)
  scope = createScope(fn, args, scope)

  //result and recurse might be the other way around, handle that.
  if(calls(result, name))
    return create_loop(args, argv, _inline(test), result.slice(1).map(_inline), _inline(recurse))
  else
    return create_loop(args, argv, _inline([eqz, test]), recurse.slice(1).map(_inline), _inline(result))
}

function wrap (fn) {
  return function (body) {
    if(body.inlined) {
    }
    var r = fn.apply(null, [].slice.call(arguments))
    r.inlined = r.inlined || new Error('first inline')
    return  r
  }
}

var inline_expr = wrap(function (body, remap) {
  if(!isDefined(body))  throw new Error('cannot inline undefined!')
  var R = (body) => inline_expr(body, remap)
  if(isBasic(body)) return body
  else if(isSymbol(body)) {
    var r = lookup(remap, body, false, true)
    return isFunction(r) ? r : r ? r.value : body
  }
  else if(body[0] === syms.block) {
    var _body = [syms.block]
    for(var i = 1; i < body.length; i++) {
      var v = R(body[i])
      if(!isBasic(v)) _body.push(v)
    }
    //if the last value was basic, keep it
    if(isBasic(v)) _body.push(v)
    //if the last item was a basic, we don't need the block.
    //no. only if the previous code was pure.
    if(_body.length === 2) return _body[1]
    return _body
  }
  else if(body[0] === syms.def) {
    var k = body[1]
    if(body.length == 2) return [syms.def, k]
    var v = R(body[2]) //didn't forget to recurse into value this time!
    return isBasic(v) ? (remap[k.description] = {value: v}).value
                      : [syms.def, k, v]
  }
  else if (body[0] === syms.if) {
    var _test = R(body[1])
    if(isBasic(_test))
      return R(body[(0 !== _test) ? 2 : 3])
    else if(body.length === 4)
      return [syms.if, _test, R(body[2]), R(body[3])]
    else
      return [syms.if, _test, R(body[2]), 0]
  }
  else {
    if(body[0] === syms.scope) {
      return body
    }
    //function  (may be recursive!)
    if(body.length === 0) throw new Error('body cannot be empty list')
    var value = isFun(body[0]) ? body[0] : lookup(remap, body[0], false)
    var args = body.slice(1).map(R) // <--------------------------,
    //if it's a FUNCTION that's a built in function, not user     |
    //defined. we can only inline that if all arguments are known.|
    //note, we already attempted to inline the args just above ---`

// HMM what was this fixing?
// I added this, but now removing it makes the tests pass...
//    if(isFunction (value) &&
//      //XXX VERY UGLY HACK TO NOT INLINE SIDE EFFECTS
//     /^(?:get_|set_|i32_store|i32_load)/.test(body[0].description)) {
//      return [body[0]].concat(args)
//    }

    if(isFunction (value) && args.every(isBasic))
      return value.apply(null, args)
    //if a function is recursive, but called with known values
    //then it can be inlined. or if it's not recursive.
    else if(isFun(value) && (
        (isRecursive(value) && args.every(isBasic)) ||
        isLoopifyable(value) ||
        !isRecursive(value)
      )) {
      return inline(value, args, remap)
    }
    else
      return [body[0]].concat(args)
  }
})

//function wrap(expr) {
//  return isBasic(expr) || isSymbol(expr) || 
//    (isArray(expr) && expr[0] === syms.scope)
//  ? expr : [syms.scope, expr]
//}

function inline (fn, argv, scope, hygene) {
  hygene = hygene || 0
  var {body, scope: _scope} = parseFun(fn)
  if(isLoopifyable(fn)) return loopify(fn, argv, scope)
  return scopify(inline_expr(
    body,
    createScope(fn, argv, _scope || scope || {}),
    fn, ++hygene
  ))
}

function inline_fun (fn) {
  var {name, args, body, scope} = parseFun(fn)
  if(isSystemFun(fn)) return fn
  return [internal.bound_fun, name, args, inline_expr(body, scope || {}, fn, 1), scope]
}

function inline_module(m) {
  if(isFun(m)) return inline_fun(m)
  else         return m.map(([k, fn]) => [k, inline_fun(fn)])
}

module.exports = {isRecursive, inline, loopify, inline_fun, inline_module}
