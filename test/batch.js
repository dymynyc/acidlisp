var acid = require('../')
var tape = require('tape')
var scopify = require('../scopify')
var stringify = require('../util').stringify

//should eval to 1
var m1 = `(block (def a 1) (def b 2) (sub a b))`
var m2 = `(block (def a 1) (def b 2) (batch (a b) (b a)) (sub a b))`

var env = require('../env')()
tape('swap using batch', function (t) {
  t.equal(acid.eval(acid.parse(m1), env), -1)
  t.equal(acid.eval(acid.parse(m2), env), 1)

  var ast = acid.parse(m2)
  var bast = scopify(ast)
  console.log(stringify(bast))
  t.equal(stringify(bast).indexOf('batch'), -1)
  t.equal(acid.eval(bast, env), 1)

  t.end()
})
