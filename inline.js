var syms = require('./symbols')

var {
  isSymbol, isBasic, isDefined, isFunction, isArray, isCore,
  isNumber,
  stringify, parseFun
} = require('./util')

var lookup = require('./lookup')

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

function loopify(fn, scope) {
  var args = fn[2]
  var name = fn[1]
  var body = fn[3] //should be an if
  assert.ok(body[0] === syms.if)
  var test = body[1]
  var recurse = body[2]
  var result = body[3]
  var flip = false
  //end and recurse might be the other way around
  if(calls(result, name)) {
    result = body[2]; recurse = body[3]; flip = true
  }
  return [syms.fun, name, args, [syms.loop,
      flip ? [Symbol('eq'), 0, test] : test,
      [syms.block].concat(args.map((arg, i) =>
        [syms.set, arg, recurse[i+1]]
      )),
      result
    ]]
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
    var args = body.slice(1).map(R)
    if(args.every(isBasic) && isFunction (remap[k]))
      return remap[k].apply(null, args)
    else if(k === name) {
      return inline(fn, args, remap, hygene)
    }
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
//  if(isLoopifyable(fn))
//    return loopify(fn, scope)

  var {name, args, body} = parseFun(fn)
  var vars = getUsedVars(body)
  //leaves a function as a call if any args are expressions.
  //but what if that expression is evalable? we should start
  //by inlining it to the maximum extent.
  if(argv.every(v => isSymbol(v) || isBasic)) {
    var remap = {__proto__: scope || {}}
    for(var i = 0; i < args.length; i++)
      remap[args[i].description] = {value: argv[i]}
    return reinline(body, remap, fn, ++hygene, vars)
  }
}
function isInlineable (fn, args) {
  return !isRecursive(fn) || !args.every(isSymbol)
}

//something is evalable (that is, completely inlineable)
//if all it's arguments are known values.
function isEvalable (body, scope) {
  if(isSymbol(body)) return lookup(scope, body, false, true)
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

module.exports = {isRecursive, isInlineable, getUsedVars, inline, loopify}
