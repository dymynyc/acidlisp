var parse  = require('../parse')
var tape   = require('tape')
var inline = require('../inline2')
var Env    = require('../env')
var {stringify} = require('../util')

var scope = Env()

var inputs = [
  '1',
  '(add a b c)',
  '[(fun (x y) (add x y)) a b]',
  //function that calls first arg with second arg as value
  '[(fun (fn y) (fn y)) (fun (a) (mul a a)) b]',
  '[(fun X (a i) (if (eq 0 i) a (X (add i a) (sub 1 i)))) 0 10]',
  '[(fun X (a i) (if (neq 0 i) [X (add i a) (sub 1 i)] a)) 0 10]',
  `[
    (fun (fn a i)
      [(fun R (a i)
        {if (gt 0 i) (R (fn a i) (sub 1 i)) a}
      ) a i]
    )
    (fun (x y) (add x y))
    j k
    ]
  `,
  '[module (export (fun () 123))]'
]

var outputs = [
  '1',
  inputs[1],
  '(scope (batch (x y) (a b)) (add x y))',
  '(scope (batch (y) (b)) (scope (batch (a) (y)) (mul a a)))',
  '(scope (batch (a i) (0 10)) (loop (eq 0 i) a (batch (a i) ((add i a) (sub 1 i)))))',
  '(scope (batch (a i) (0 10)) (loop (eqz (neq 0 i)) a (batch (a i) ((add i a) (sub 1 i)))))',
  '(scope (batch (a i) (j k)) (scope (batch (a i) (a i)) (loop (eqz (gt 0 i)) a (batch (a i) ((scope (batch (x y) (a i)) (add x y)) (sub 1 i))))))',
  '(module (export (fun () 123)))'
]

inputs.forEach(function (src, i) {
  var ast = parse(src)
    tape('inline:'+src, function  (t) {
    t.equal(stringify(inline(ast, scope)), outputs[i])
    console.log(outputs[i])
    t.end()
  })
})
