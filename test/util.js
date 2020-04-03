var parse   = require('../parse')
var expand  = require('../')
var tape    = require('tape')
var u       = require('../util')
var inspect = require('util').inspect

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

  // this example currently ends up as (fun () (suc 6))
  // but clearly (suc 6) can be flattened because it's pure
  // and all it's args are bound

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

  t.end()
})
