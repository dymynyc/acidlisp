var tape = require('tape')
var acid = require('../')
var syms = require('../symbols')

var {
  isRecursive, isInlineable, getUsedVars, inline, loopify
} = require('../inline')

var {
  isSymbol, isBasic, isDefined, isFunction, isArray, isCore,
  isNumber,
  stringify, parseFun
} = require('../util')
//okay, lets experiment with inlining.

var src = `(fun (x y z) {add x (add y z)})`

var args = `(1 2 3)`
//then lets say we call it with `(1 y 3)`


var add_xyz = `(fun (x y z) {add x (add y z)})`
var scope = {
  add: function (a, b) { return   a +   b  },
  sub: function (a, b) { return   a -   b  },
  lte: function (a, b) { return +(a <=  b) },
  lt : function (a, b) { return +(a <   b) },
  gt : function (a, b) { return +(a >   b) },
  mul: function (a, b) { return   a *   b  },
  neq: function (a, b) { return +(a !== b) },
  eq : function (a, b) { return +(a === b) },
}

var test_if = `(fun (test t f) {if test t f})`



//this recursive function could be converted into a loop.
//actually it would be quite complicated. depends on the stack
//to only apply an action on the way out. but it also
//does (sub N 1) before recursing.
var recursive = `
(fun R (x N)
  (if (lte N 0) x (R (add 1 x) (sub N 1)) )
)
`
var vars = `(fun (x y) {block
  (def z (add x y))
  (mul z z)
})`

var loop = `(fun (N)
(block
  (def sum 0)
  (def i 0)
  (loop (lt i N)
    (block
      (def sum (add sum (add 1 i)))
      (def i (add 1 i)) ))
  sum
))`

//pipe((range 0 10) sum)

var reducer = `
(fun range (start end value) (fun (reduce) (fun R (value start)
  (if (gte start end) value (R reduce(value start) (add 1 start)))
)))
`

var filter = `
(fun (test) (fun (reduce) (fun (acc item)
  (if (test item) (reduce acc item) acc) )))
`

var tests = [
  [add_xyz, '(1 2 3)', null,  '(add 1 (add 2 3))'],
  [add_xyz, '(1 y 3)', null,  '(add 1 (add y 3))'],
  [add_xyz, '(a 2 3)', null,  '(add a (add 2 3))'],
  [add_xyz, '(1 2 3)', scope, '6'],
  [add_xyz, '(x 100 200)', scope, '(add x 300)'],
  [test_if, '(1 b c)', scope, 'b'],
  [test_if, '(0 b c)', scope, 'c'],
  [recursive, '(y 3)', scope, '(add 1 (add 1 (add 1 y)))'],
  [recursive, '(x M)', scope],
  [vars, '(a b)', scope, '(block (def z (add a b)) (mul z z))'],
  [vars, '(1 2)', scope, '9'],
  [loop, '(10)', scope, '55']
]

tape('isRecursive', function (t) {
  t.equals(isRecursive(acid.parse('(fun R (x) (R x))')), true)
  t.equals(isRecursive(acid.parse('(fun (x) (x))')), false)
  t.end()
})

tape('getUsedVars', function (t) {
  var vars = getUsedVars(acid.parse(loop))
  console.log(vars)
  t.end()
})

tests.forEach(function (v, i) {
  tape('inline:('+v[0]+' '+v[1]+')', function (t) {
    var [src, args, scope, output] = v
    var start = Date.now()
    var fn = acid.parse(src)
    var argv = acid.parse(args)
    t.equal(isInlineable(fn, argv), !!output)
    if(isInlineable(fn, argv))
      var ast = inline(fn, argv, scope)
//    else
//      var ast = loopify(fn)
    console.log('time', Date.now()- start)
    console.log(output)
    if(output)
      t.equal(stringify(ast), output)
    else
      t.notOk(stringify(ast))
    t.end()
  })
})

tape('loopify', function (t) {
  var recurse = '(fun R (sum N) (if (gt N 0) (R (add N sum) (sub N 1)) sum))'
  var ast = acid.parse(recurse)
  var loopy = loopify(ast)
  console.error(stringify(loopy))
  t.end()
})
