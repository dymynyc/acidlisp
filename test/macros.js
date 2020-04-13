var tape = require('tape')
var env  = require('../env')
// MACROS

// okay, I think I got it figured out.
// macros are like functions, but they run
// _during_ function evaluation.

// at the same time as _bind_ (as currently implemented in eval.js)
// the AST is traversed in the same manner as for eval,
// except when we find a macro, just call it, without evaluating
// the arguments.
// when a macro returns, run bind on the output too, until no macros remain.

var parse = require('../parse')
var {stringify} = require('../util')
var ev = require('../eval')

var swap =
  parse(`(mac swap (a b) &(block (def tmp a) (def a b) (def b tmp)))`)

tape('swap', function  (t) {
  var body = swap[3]
  var result = ev(body, {a: Symbol('x'), b: Symbol('y')})
  t.equal(stringify(result), '(block (def tmp x) (def x y) (def y tmp))')
  t.end()
})

var inputs = [
  `[{mac swap (a b) &[block (def tmp a) (def a b) (def b tmp)]} j k]`,
  `
  [(mac unroll (l fn) {block
      (def value (head l))
      (def rest (tail l))

      (if
        (is_empty rest)
          [list (quote (fn value))]
        (block
          (def rest (quote (unroll rest fn)) )
          (cat [list &(fn value)] &rest)
        )
      )
    })
    (1 2 3 4 5)
    square
  ]
  `,
  `
  (block
    (def double (mac (c) {block
      [list (head c) [quote c]]
    }))
    (double (square x))
  )
  `
]

var outputs = [
  '(block (def tmp j) (def j k) (def k tmp))',
  //still not fully decided how to handle lists?
  '((square 1) (square 2) (square 3) (square 4) (square 5))',
  '(block (mac (c) (block (list (head c) (quote c)))) (square (square x)))'
]

inputs.forEach((v, i) => {
  tape(inputs[i] +' => '+ outputs[i], function (t) {
    var result = ev.bind(parse(inputs[i]), env)
    t.equal(stringify(result), outputs[i])
    t.end()
  })
})
