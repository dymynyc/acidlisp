var {
  isArray, isSymbol, isFun, isBoundFun, isSystemFun, isBasic,
  isFunction, isLookup, parseFun,
  stringify
} = require('./util')
var internal = require('./internal')
var lookup = require('./lookup')
var syms = require('./symbols')

/*
;;don't need to inline
(fun (a b c) (add a b c))

;;inline function gets inlined
(fun (a b) {(fun (x y) (add x y)) a b})

;; have to inline map because it's argument is a function
;; so requires an inline
(fun (a b) {map a (fun (_a) (add _a b))}

;; special case for recursive
(fun R (i) {if (gt i 0) (R (sub i 1)) result})
*/

function calls (ast, name) {
  return isArray(ast) && isSymbol(ast[0]) && (
    ast[0] === name ||
    ast[0].description === name.description
  )
}

function calls_recursive (ast, name) {
  return (
    !isArray(ast)    ? false
  : calls(ast, name) ? true
  :                    !!ast.find(e => calls_recursive(e, name))
  )
}

function isLoopable (fn) {
  var {name, body} = parseFun(fn)
  return (
    name &&
    body[0] === syms.if &&
    (calls(body[1], name) ^ calls(body[2], name))
  )
}

function isRecursive (fn) {
  var {args, name, body} = parseFun(fn)
  if(!name) return false
  return calls_recursive(body, name)
}

//check if a function has any vars scoped in
//(except ignoring function calls)
function hasFreeVars (fn) {
  var {name, args, body} = parseFun(fn)
  var _args = {}

  for(var i in args) _args[args[i].description] = true
  function isArg (s) {
    return isSymbol(s) && _args[s.description]
  }

  return (function R (ast) {
    var isKnown = v => isArg(v) || isBasic(v) || R(v)
    if(isArray(ast)) {
      var op = ast[0]
      var args = ast.slice(1)
      if(syms.def === op) {
        var r = isKnown(args[1])
        _args[args[0].description] = true
        return r
      }
      else
        return args.every(isKnown)
    }
  })(body)
}

var eqz = Symbol('eqz')
function recursive_to_loop (fn) {
  var {args, name, body} = parseFun(fn)
  var [_if, test, recurse, result] = body
  var swap = false
  if(isArray(result) && calls(result, name)) {
    var tmp = recurse; recurse = result; result = tmp
    swap = true
  }
  return [syms.fun, args,
    [syms.loop,
      swap ? [eqz, test]: test,
      [syms.batch, args, recurse.slice(1)],
      result
    ]
  ]
}

//inline straight forward call, using scope and batch.
function inline_call (fn, argv, scope) {
  if(!isFun(fn)) throw new Error('expected fun')
  var {args, name, body, scope: __scope} = parseFun(fn)
  var _args = [], _argv = [], _scope = {__proto__: scope}
  argv.forEach((v, i) =>  {
    if(isFun(v))
      _scope[args[i].description] = {value:  v}
    else {
      _args.push(args[i])
      _argv.push(v)
    }
  })
  //check if function body has free vars into it's def scope.
  body = bind_scope(body, __scope, scope)
  return [syms.scope, [syms.batch, _args, _argv], inline(body, _scope)]
}

//just leave it as an ordinary call.
function uninline_call (op, argv) {
  return [op].concat(argv)
}

//insert variable defs for values accessed in the scope.
//not yet implemented.
function bind_scope (body, local_scope, call_scope) {
  return body
  //  throw new Error('nyi')
}


function inline (ast, scope) {
  var R = v => inline(v, scope)

  if(isFun(ast))
    return ast

//  if(isBoundFun(ast)) {
//    var fn = ast
//    var {name, args, body, scope} = parseFun(fn)
//    if(isSystemFun(fn)) return fn
//
//    return [internal.bound_fun, name 
//  }

  else if(isArray(ast)) {
    var op = ast[0]
    if(op === syms.batch) {
      return [syms.batch, ast[1], ast[2].map(R)]
    }

    var argv = ast.slice(1).map(R)
    var fn = isLookup(op) ? lookup(scope, op) : fn = op
    if(!op)
      console.error(ast)
    if(!fn) throw new Error('could not resolve:'+op.description)
    //built-in function, so inline the args
    if(isFunction(fn)) return uninline_call(op, argv)

    if(isRecursive(fn)) {
      return inline_call(recursive_to_loop(fn), argv, scope)
    }
    //if a function has free vars, it must be inlined.
    //(although if it doesn't have free vars, it could be spun out)
    var free = hasFreeVars(fn)
    var pass_fn = !argv.every(v => !isFun(v))
    return (
        isFun(fn) && (free || pass_fn || op === fn)
      ? inline_call  (fn, argv, scope)
      : uninline_call(op, argv)
    )
  }
  else
    return ast
}

function inline_fun (fn, _scope) {
  var {name, args, body, scope} = parseFun(fn)
  if(isSystemFun(fn)) return fn
  scope = scope || _scope || {}
  body = bind_scope(body, scope, _scope)
  return [internal.bound_fun, name, args, inline(body, scope), scope]
}

function inline_module(m) {
  if(isFun(m) || isBoundFun(m)) return inline_fun(m)
  else         return m.map(([k, fn]) => [k, inline_fun(fn)])
}


exports = module.exports = inline
exports.inline_fun = inline_fun
exports.inline_module = inline_module
