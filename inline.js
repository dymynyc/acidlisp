var assert = require('assert')
var syms = require('./symbols')
var lookup = require('./lookup')

var {
  isSymbol, isBasic, isDefined, isFunction, isArray, isCore,
  isNumber, isFun,
  stringify, parseFun
} = require('./util')


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
//check if there are vars defined but not used.
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

function isLoopifyable (fn) {
  var {name, args, body} = parseFun(fn)
  return (
    isRecursive(fn) && isSymbol(name) && isArray(body) &&
    body[0] === syms.if && !calls(body[1], name) &&
    (calls(body[2], name) ^ calls(body[3], name))
  )
}

function _loopify(args, argv, test, result, recurse) {
  return [syms.block].concat(
    args.map((s, i) => [syms.def, s, argv[i]])
  ).concat([
    [syms.loop, test,
      [syms.block].concat(
        args.map((arg, i) => [syms.set, arg, recurse[i+1]])
      ),
      result
    ]
  ])
}

function loopify(fn, argv, scope) {
  var hygene = 1, vars = {}
  var {name, args, body} = parseFun(fn)

  var [_if, test, result, recurse] = body
  assert.ok(_if === syms.if)

  scope = createScope(fn, (k, i) => argv[i], scope)

  //if test can be evaled, we can flatten the loop.
  var r = _inline(test, scope, fn, hygene, vars)
  if(isBasic(r))
    return _inline(r ? result : recurse, scope, fn, hygene, vars)

  //end and recurse might be the other way around, handle that.
  if(calls(result, name))
    return _loopify(args, argv, [syms.eq, 0, test], recurse, result)
  else
    return _loopify(args, argv,              test , result, recurse)
}

function blockify (fn, argv, scope, hygene) {
  var {args, body} = parseFun(fn)
  return [syms.block]
    .concat(argv.map((v, i) => [syms.def, args[i], v]))
    .concat([_inline(body, remap, fn, hygene, vars)])
}

function _inline (body, remap, fn, hygene, vars) {
  if(!isNumber(hygene)) throw new Error('hygene must be an integer')
  var R = (body) => _inline(body, remap, fn, hygene, vars)
  var {name} = parseFun(fn)
  name = isSymbol(name) ? name.description : null
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
      throw new Error('not implemented')
  }
  else if(body[0] === syms.def) {
    var k = body[1]
    var v = R(body[2]) //didn't forget to recurse into value this time!
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
    else
      return [syms.if, _test, R(body[2]), R(body[3])]
  }
  else {
    //function  (may be recursive!)
    var k = body[0].description
    var value = isFun(body[0]) ? body[0] : lookup(remap, body[0], false)
    var args = body.slice(1).map(R) // <--------------------------\
    //if it's a FUNCTION that's a built in function, not user     |
    //defined. we can only inline that if all arguments are known.|
    //note, we already attempted to inline the args just above ---/
    if(isFunction (value) && args.every(isBasic))
      return value.apply(null, args)
    else if(isFun(value)) //this might be a recursive function.
      return inline(value, args, remap, hygene)
    else
      return [body[0]].concat(args)
  }
}

function reinline(body, remap, fn, hygene, vars) {
  var _body = _inline(body, remap, fn, hygene, getUsedVars(body))
  if(!needsReInline(_body)) return _body
  return _inline(_body, remap, fn, hygene, getUsedVars(_body))
}

function inline(fn, argv, scope, hygene, vars) {
  hygene = hygene || 0
  if(isLoopifyable(fn)) return loopify(fn, argv, scope)
  var {body} = parseFun(fn)
  return reinline(
    body,
    createScope(fn, (k,i) => argv[i], scope||{}),
    fn, ++hygene, getUsedVars(body)
  )
}
function isInlineable (fn, args) {
  return !isRecursive(fn) || !args.every(isSymbol)
}

function isEmpty (o) {
  for(var k in o) return false
  return true
}

module.exports = {isRecursive, isInlineable, getUsedVars, inline, loopify, blockify}
