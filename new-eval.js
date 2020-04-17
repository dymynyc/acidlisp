
var syms = require('./symbols')
var boundf = Symbol('bound_fun')
var boundm = Symbol('bound_mac')
var {isSymbol, isFun, isBasic, isFunction, isArray, stringify} = require('./util')

function isBoundMac (m) {
  return isArray(m) && boundm === m[0]
}

function bind (body, scope) {
  if(Array.isArray(body)) {
    if(body[0] === syms.mac)
      return bind_mac(body, scope)
    else  if(body[0] === syms.quote)
      return body
    else if(body[0] === syms.unquote) {
      return ev(body[1], scope)
    }

    var bm = bind(body[0])
    if(isBoundMac(bm))
      return call(bm, body.slice(1))
    else
      return [bm].concat(body.slice(1).map(b => bind(b, scope)))
  }
  return body
  //if(isBasic(body)) return body
//  else throw new Error('bind not supported: '+stringify(body))
}

function bind_fun (fun, scope) {
  if(isSymbol(fun[1]))
    name = fun[1], args = fun[2], body = fun[3]
  else
    name = null, args = fun[1], body = fun[2]
  return [boundf, name, args, bind(body, scope), scope]
}
function bind_mac (fun, scope) {
  if(isSymbol(fun[1]))
    name = fun[1], args = fun[2], body = fun[3]
  else
    name = null, args = fun[1], body = fun[2]
  return [boundm, name, args, bind(body, scope), scope]
}
function lookup(scope, sym) {
  if(scope.has(sym))
    return scope.get(sym)
  else if(scope.parent)
    return lookup(scope.parent, sym)
}
function call (fn, argv) {
  if(isFunction(fn))
    return fn.apply(null, argv)

  if(fn[0] !== boundf && fn[0] !== boundm) throw new Error('expected bound function:' + stringify(fn))
  var scope = new Map()
  scope.parent = fn[4]
  var args = fn[2], body = fn[3]
  for(var i = 0; i < args.length; i++)
    scope.set(args[i], argv[i])
  return ev(body, scope)
}

function  $(name) {
  return Symbol(name)
}

function ev(ast, scope) {
  if(isFun(ast))
    return bind_fun(ast, scope)
  if(Array.isArray(ast)) {
    if(ast[0] === syms.quote)
      return quote(ast[1], scope)

    var bf = ev(ast[0], scope)
    if(!bf)
      throw new Error('expected function:'+stringify(ast))

    return call(bf, ast.slice(1).map(v => ev(v, scope)))
  }
  else if(isBasic(ast))
    return ast
  else if(isSymbol(ast)) //variable!
    return lookup(scope, ast)
  else
    throw new Error('not supported yet:'+stringify(ast))
}

var assert = require('assert')

function quote (ast, scope) {
  if(isArray(ast)) {
    if(ast[0] === syms.unquote)
      return ev(ast[1], scope)
    return ast.map(v => quote (v, scope))
  }
  return ast
}

console.log('test 1')
var  a =$('a'), b = $('b'), add = $('add'), eq = $('eq')

var scope = new Map()
scope.set(add, function () {
  return [].slice.call(arguments).reduce((a,b) => a + b)
})
scope.set(eq, function (a, b) {
  return a === b
})
var code = [[syms.fun, [a, b], [add, a, b, 3]], 1, 2]

assert.equal(ev(code, scope), 6)

console.log('test 2')
var x = $('x'), y = $('y')
var fun = [syms.fun, [x, y], [add, x, y]]

// evaluating the exact same function twice should produce
// two distinct bound functions. this might happen to a function
// defined inside a loop
assert.notStrictEqual(ev(fun, scope), ev(fun, scope))

console.log('test 3')

var quoted = quote([a, b, [syms.unquote, [add, 1, 2]]], scope)
assert.strictEqual(quoted[0], a)
assert.strictEqual(quoted[1], b)
assert.strictEqual(quoted[2], 3)

console.log('test 4, macros and quotes')

function U (ast) { return [syms.unquote, ast] }
function Q (ast) { return [syms.quote, ast] }
var mac = [syms.mac, [x], Q([syms.def, U(x), [add, U(x), 1]])]

assert.deepEqual(stringify(bind([mac, $('z')])), '(def z (add z 1))')

//NOTE: if you use unquote outside of quote, it will run that code
//at bind time.
assert.deepEqual(stringify(bind([add, 1, U([add, 7, 3]) ], scope)), '(add 1 10)')

console.log('passed')
