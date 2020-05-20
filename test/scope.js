var tape = require('tape')
var acid = require('../')
var {isArray, isSymbol, stringify} = require('../util')
var scopify = require('../scopify')

function copy (ast) {
  return ast.map(e => isArray(e) ? copy(e) : e)
}

var scope = {
  add: function (a, b) { return a + b }
}

var inputs = [
  `(block (def a 1) (def b (scope (def a 2))) a)`,
  `(block (def a 1) (def b (scope (set a 2))) a)`,
  `
  (block
    (def a 1)
    (def b (scope (set a 3)))
    (scope (def a 2))
    a
  )`,
  `
  (block
    (def a 1)
    (def b (scope (def a (scope (def a 2)))))
    (def a (scope (def a (add 3 a))))
    a
  )`,
  `
  (block
    (def a 2)
    (scope (def a 7) (def b 5))
    (def b (add 3 a))
   b
  )`,

]

var outputs = [1, 2, 3, 4, 5]

tape('eval scope', function (t) {
  for(var i = 0; i < inputs.length; i++) {
    var ast = acid.parse(inputs[i])
    t.equal(acid.eval(ast, scope), outputs[i])
  }
  t.end()
})

tape('eval scope', function (t) {
  for(var i = 0; i < inputs.length; i++) {
    var ast = acid.parse(inputs[i])
    scopify(ast, {}, 0)
    console.log(i)
    console.log(stringify(acid.parse(inputs[i])))
    console.log(stringify(ast))
    t.equal(acid.eval(ast, scope), outputs[i])
  }
  t.end()
})
