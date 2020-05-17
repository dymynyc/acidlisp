var assert = require('assert')
var syms = require('./symbols')
var lookup = require('./lookup')
var internal = require('./internal')
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
  map = map || (v => v)
  for(var i = 0; i < args.length; i++)
    scope[args[i].description] = {value: map(args[i], i)}
  if(name)
    scope[name.description] = {value: fn}
  return scope
}

function reduceVars(body, update) {
  var vars = {}
  ;(function R (b) {
    if(isSymbol(b))
      update(vars, b, false) //[b.description] = (vars[b.description] || 0) + 1
    else if(isArray(b)) {
      if(b[0] === syms.def) {
        update(vars, b[0], true); R(b[2])
      }
      else b.forEach(R)
    }
  })(body)
  return vars
}

function getUsedVars (body) {
  return reduceVars(body, (vars, k, isDef) => {
    if(!isDef) vars[k.description] = (vars[k.description] || 0) + 1
  })
}

//hope i can delete this.
//checks if there are vars defined but not used.
function needsReInline(body) {
  return !isEmpty(reduceVars(body, (vars, k, isDef) => {
    if(isDef) vars[k.description] = true
    else delete vars[k.description]
  }))
}


function isRecursive (fn) {
  var {name, body} = parseFun(fn)
  //can't be recursive if it does not refer to itself.
  return name ? !!getUsedVars(body)[name.description] : false
}

function calls (ast, name) {
  return isArray(ast) && isSymbol(ast[0]) && ast[0].description === name.description
}

function blockify (args, argv, result) {
  return [syms.block]
    .concat(args.map((k, i) => [syms.def, k, argv[i]]))
    .concat(result ? [result] : [])
}

function isLoopifyable (fn) {
  var {name, args, body} = parseFun(fn)
  return (
    isRecursive(fn) && isSymbol(name) && isArray(body) &&
    body[0] === syms.if && !calls(body[1], name) &&
    (calls(body[2], name) ^ calls(body[3], name))
  )
}

function _loopify(args, argv, test, recurse, result) {
  return blockify(args, argv,
    [syms.loop, test, blockify(args, recurse), result])
}

var eqz = Symbol('eqz')

function loopify(fn, argv, scope) {
  var hygene = 1
  var {name, args, body} = parseFun(fn)

  var [_if, test, result, recurse] = body
  assert.ok(_if === syms.if)

  //check if the test expression can be evaled,
  //if so, unroll the recursion.
  scope = createScope(fn, (k, i) => argv[i], scope)
  var _inline = a => inline_expr(a, scope, fn, hygene)

  var r = inline_expr(test, scope, fn, hygene)
  if(isBasic(r)) return _inline(r ? result : recurse)

  //else, make sure we don't override the parameters!
  scope = createScope(fn, (k, i) => args[i], scope)

  //result and recurse might be the other way around, handle that.
  if(calls(result, name))
    return _loopify(args, argv, _inline(test), result.slice(1).map(_inline), _inline(recurse))
  else
    return _loopify(args, argv, _inline([eqz, test]), recurse.slice(1).map(_inline), _inline(result))
}

function loopify_fun(fn, scope) {
  var hygene = 1
  var {name, args, body} = parseFun(fn)

  var [_if, test, result, recurse] = body
  assert.ok(_if === syms.if)

  function _loopify (args, test, recurse, result) {
    return [syms.fun, name, args, [syms.loop, test, blockify(args, recurse), result]]
  }
  //end and recurse might be the other way around, handle that.
  if(calls(result, name))
    return _loopify(args, test, result.slice(1), recurse)
  else
    return _loopify(args, [eqz, test], recurse.slice(1), result)
}

function inline_expr (body, remap, fn, hygene, vars) {
  if(!isNumber(hygene)) throw new Error('hygene must be an integer')
  var R = (body) => inline_expr(body, remap, fn, hygene, vars)
  var {name} = parseFun(fn)
  name = isSymbol(name) ? name.description : null
  if(!isDefined(body))
    throw new Error('cannot inline undefined!')
  if(isBasic(body)) return body
  else if(isSymbol(body)) {
    var r = lookup(remap, body, false, true)
    return isFunction(r) ? r : r ? r.value : body
  }
  else if(body[0] === syms.block) {
    var _body = [syms.block]
    for(var i = 1; i < body.length; i++) {
      var v = R(body[i])
      if(!isBasic(v))
        _body.push(v)
    }
    //if the last value was basic, keep it
    if(isBasic(v)) _body.push(v)
    //if the last item was a basic, we don't need the block.
    //no. only if the previous code was pure.
    if(_body.length === 2) return _body[1]
    return _body
  }
  else if(body[0] === syms.loop) {
    var test = R(body[1])
    if(isBasic(test)) { //we are inlining this one!
      var block = [syms.block]
      while(isBasic(test) && test) {
        block.push(R(body[2]))
        test = R(body[1])
      }
      block.push(body[3] ? R(body[3]) : 0)
      return block
    }
    else
      //if the test is not resolvable
      //then maybe there is still some partial inlining
      //of the body.
      return body
  }
  else if(body[0] === syms.def) {
    var k = body[1]
    var v = R(body[2]) //didn't forget to recurse into value this time!

    //okay problem is we are inlining a function that can see
    //another function in it's closure that we can't see.

    if(isBasic(v)) {
      remap[k.description] = {value: v}
      //if this variable gets used again, keep the def
      //maybe this will removed in a second pass though.
      if((vars[k.description] | 0) <= 1) return v
      return [syms.def, k, v]
    }
    else
      //if the function has local variables
      return [syms.def, k, v]
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
    //function  (may be recursive!)
    if(body.length === 0) throw new Error('body cannot be empty list')
    var value = isFun(body[0]) ? body[0] : lookup(remap, body[0], false)
    var args = body.slice(1).map(R) // <--------------------------,
    //if it's a FUNCTION that's a built in function, not user     |
    //defined. we can only inline that if all arguments are known.|
    //note, we already attempted to inline the args just above ---`
    if(isFunction (value) &&
      //XXX VERY UGLY HACK TO NOT INLINE SIDE EFFECTS
     /^(?:get_|set_|i32_store|i32_load)/.test(body[0].description)) {
      return [body[0]].concat(args)
    }
    if(isFunction (value) && args.every(isBasic))
      return value.apply(null, args)
    //if a function is recursive, but called with known values
    //then it can be inlined. or if it's not recursive.
    else if(isFun(value) && (
        (isRecursive(value) && args.every(isBasic)) ||
        isLoopifyable(value) ||
        !isRecursive(value)
      )) {
      return inline(value, args, remap, hygene)
    }
    else
      return [body[0]].concat(args)
  }
}

function reinline(body, remap, fn, hygene) {
  var _body = inline_expr(body, remap, fn, hygene, getUsedVars(body))
  if(!needsReInline(_body)) return _body
  return inline_expr(_body, remap, fn, hygene, getUsedVars(_body))
}

function inline (fn, argv, scope, hygene) {
  hygene = hygene || 0
  var {body, scope: _scope} = parseFun(fn)
  if(isLoopifyable(fn)) return loopify(fn, argv, scope)
  return reinline(
    body,
    createScope(fn, (k,i) => argv[i], _scope || scope || {}),
    fn, ++hygene
  )
}

function inline_fun (fn) {
  var {name, args, body, scope} = parseFun(fn)
  if(isSystemFun(fn)) return fn
  if(isLoopifyable(fn)) return loopify_fun(fn, scope)
  return [internal.bound_fun, name, args, reinline(body, scope || {}, fn, 1), scope]
}
function isInlineable (fn, args) {
  return !isRecursive(fn) || !args.every(isSymbol)
}

function inline_module(m) {
  if(isFun(m))
    return inline_fun(m)
  else {
    return m.map(([k, fn]) => [k, inline_fun(fn)])
  }
}

function isEmpty (o) {
  for(var k in o) return false
  return true
}

module.exports = {isRecursive, isInlineable, getUsedVars, inline, loopify, inline_fun, inline_module}
