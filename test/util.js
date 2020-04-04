var parse   = require('../parse')
var expand  = require('../')
var tape    = require('tape')
var u       = require('../util')
var inspect = require('util').inspect
var compile = require('../compile/js')
var {
  isDefined, isSymbol, isArray,
  isDef, isEmpty, isFunction, isNumber, isBound,
  eqSymbol, equals
} = require('../util')

function sym2string (sym) {
  return sym.description
}

var env = {add: function ([a, b]) { return a + b }}

tape('free variables', function (t) {

  var fn = expand(parse('(fun fn (foo bar) (cat foo baz bar))'), {})
  console.log(fn)
  console.log(u.freeVariables(fn))

  t.deepEqual(u.freeVariables(fn).map(sym2string), ['cat', 'baz'])

  var ddd = function () {}
  ddd.source = parse('(fun ddd () null)')

  var fn = expand(parse('(fun fn (foo bar) (ddd foo baz bar))'), {ddd: ddd})
  console.log(inspect(fn, {depth: 10, colors: true}))
  t.deepEqual(u.freeVariables(fn).map(sym2string), ['baz'])

  //free variables doesn't include BOUND functions.
  var fn2 = expand(parse('(fun fn (foo bar) (ddd foo bar))'), {ddd: ddd})

  //should be completely flat
  console.log(u.stringify(u.unroll(fn2)))

  //functions evaled at load time, but everything is fully bound
  var seven = expand(parse(`
  (module
    (def create {fun (x) [fun () x]})
    (def seven [create 7])
    seven)
  `), {})[3]

  t.deepEqual(u.stringify(u.unroll(seven)), '(module (export (fun () 7)))')

  // this example gets flattened to 7, because we can eval (suc x) and (add x 1)
  // without more data. This wouldn't work if suc wasn't pure.

  var src = `
  (module
    (def suc {fun (x) [add x 1]})
    (def create {fun (x) [fun () (suc x)]})
    (def seven [create 6])
    seven)
  `
  var ast = parse(src)
  var seven2 = expand(ast, env)[4]
  t.deepEqual(u.stringify(u.unroll(seven2)), '(module (export (fun () 7)))')
  console.log(u.unroll(seven2))
  console.log("COMPILE.js", compile(u.unroll(seven2)))
  t.end()

  var points = `
  (module
    (def point (struct {x: f64 y: f64}))
    (def length {fun [(p point)] (sqrt (add (mul p.x p.x) (mul p.y p.y)))})
  )
  `
})
