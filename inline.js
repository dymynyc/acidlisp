var syms = require('./symbols')

var {
  isSymbol, isBasic, isDefined, isFunction, isArray, isCore,
  isNumber, isFun,
  stringify, parseFun
} = require('./util')

var lookup = require('./lookup')

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

function getUsedVars (body) {
  var vars = {}
  ;(function R (b) {
    if(isSymbol(b))
      vars[b.description] = (vars[b.description] || 0) + 1
    else if(isArray(b)) {
      //definition doesn't count as a use.
      if(b[0] === syms.def) R(b[2])
      else                  b.forEach(R)
    }
  })(body)
  return vars
}

function removeUnusedVars (body, used) {
  if(isArray(body) &&
    body[0] === syms.def &&
    !~used.indexOf(body[1])) //this var isn't used.
    //now, if it's in another expression, the value might
    //still be used. if it's in a block it can be dropped.
    //but clean up blocks at the next level.
    return body[2]
  else
    return body.map(b => removeUnusedVars(body, used))
}

function isRecursive (fn) {
  var {name, body} = parseFun(fn)
  //can't be recursive if it does not refer to itself.
  if(!isSymbol(name)) return false
  return !(function R (s) {
    return (
        isSymbol(s) && s.description == name.description
                   ? false
      : isBasic(s) ? true
      : isArray(s) ? s.every(R)
      : isSymbol(s) && isCore(s) ? false
      : (function () { throw new Error('unexpected:'+stringify(s))})()
    )
  })(body)
}

var assert = require('assert')

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
  var r = _inline(test, scope, fn, hygene, vars)
  //if test can be evaled, we can flatten the loop.
  if(isBasic(r)) return inline(fn, argv, scope)

  //end and recurse might be the other way around, handle that.
  if(calls(result, name))
    return _loopify(args, argv, [syms.eq, 0, test], recurse, result)
  else
    return _loopify(args, argv,              test , result, recurse)
}

function blockify (fn, argv, scope, hygene) {
  var {args, body} = parseFun(fn)
  //look for args that are:
  // used more than once (will need a def)
  // not used (drop)
  // if the argv is an expression
  //   will need a def if used more than once
  // if argv is a symbol
  //   just replace fn's internal symbol with that one.
  //     ...that won't work if it's mutable.

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
    return r ? r.value : body
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
    var args = body.slice(1).map(R) // <--------------------------\
    var value = lookup(remap, body[0], false)      //             |
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
  var _body = _inline(body, remap, fn, hygene, vars)
  if(!needsReInline(_body)) return _body
  var _vars = getUsedVars(_body)
  return _inline(_body, remap, fn, hygene, _vars)
}

function inline(fn, argv, scope, hygene, vars) {
  hygene = hygene || 0
  var remap = createScope(fn, (k,i)=>argv[i], scope||{})
//  if(isLoopifyable(fn)) {
//    var _fn = loopify(fn, scope)
//    console.log('loopify', stringify(_fn))
//    console.log('vars', argv)
////    var {args, body} = parseFun(_fn)
//  //  return _inline(body, remap, fn, hygene, vars)
//  }
  var {name, args, body} = parseFun(fn)
  var vars = getUsedVars(body)
  //leaves a function as a call if any args are expressions.
  //but what if that expression is evalable? we should start
  //by inlining it to the maximum extent.
  return reinline(body, remap, fn, ++hygene, vars)
}
function isInlineable (fn, args) {
  return !isRecursive(fn) || !args.every(isSymbol)
}

/*
  (create fields...) => <Struct fields...>

  (create size: i32 keyType:Type valueType: Type) =>  <HashTable keyType valueType>

  (set <HashTable keyType valueType>, key: keyType)=>valueType
*/

//something is evalable (that is, completely inlineable)
//if all it's arguments are known values.
function isEvalable (body, scope) {
  if(isBasic(body)) return true
  else if(isSymbol(body)) return lookup(scope, body, false, true)
  else if(isArray(body))
    return isFun(body[0]) && body.slice(1).every(isEvalable)
}

function isEmpty (o) {
  for(var k in o) return false
  return true
}

//hope i can delete this.
//check if there are vars defined but not used.
function needsReInline(body) {
  var defined = {}
  ;(function R (b) {
    if(isSymbol(b))
      delete defined[b.description]
    else if(isArray(b)) {
      //definition doesn't count as a use.
      if(b[0] === syms.def) {
        defined[b[1].description] = true
        R(b[2])
      }
      else b.forEach(R)
    }
  })(body)
  return !isEmpty(defined)
}

module.exports = {isRecursive, isInlineable, getUsedVars, inline, loopify, loopify2, blockify}
