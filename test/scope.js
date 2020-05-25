var tape = require('tape')
var acid = require('../')
var {isArray, isSymbol, stringify, pretty} = require('../util')
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
  )`
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


tape('scope', function (t) {
  //here is a real case that didn't work.
  //the lone var at the end wasn't getting replaced.
  var src =  `
    (def foo
      [scope
        ;;start of free memory stored in free global
        (def free (i32_load 0))
        ;; never alloc data at 0, because it looks like a null pointer.
        (if (eq 0 free) (set free 4) 0)
        ;;move it forward, by the amount requested
        ;;also store at memory location 0
        (def _free (add free size))
        (i32_store 0 _free)
        (set_global 0 _free)
        ;;return the old position
        free
      ])`
    var ast = acid.parse(src)
    scopify(ast, {}, 0)
    console.log(pretty(ast))
    t.notEqual(ast[1], ast[2][ast[2].length-1])
  t.end()

})
