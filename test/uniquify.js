var parse = require('../parse')
var uniquify = require('../uniquify')
var tape = require('tape')
var pretty = require('../util').pretty
var inputs = [
  '(block (def foo 1) (def bar 2) (add foo bar))',
  '(block (def foo 1) (def bar [fun (foo) (mul foo foo)]) (add foo (bar 2)))',
  `(block
    (def foo 1)
    (def qux 2)
    (def bar [fun (baz) {block
      (def foo (mul baz baz))
      (mul qux foo)
    }])
    (add foo (bar 2))
  )`,
  `
  (block
    (def foo (import "foo"))
    (foo.bar 2 1)
  )
  `,
  `(block
    (def x y)
    (add x y)
  )`,
  //x is defined, so gets mapped
  // but y is in global scope so leave it.
  '[(fun (x) {block (def y x) (add y 10)}) 20]'
]

inputs.forEach(v => {
  tape('uniquify:'+v, function (t) {
    console.log(pretty(uniquify(parse(v))))
    t.end()
  })
})
