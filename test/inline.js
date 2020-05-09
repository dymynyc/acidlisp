var tape = require('tape')
var acid = require('../')
var syms = require('../symbols')

var {
  isRecursive, isInlineable, getUsedVars, inline
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
  add: function (a, b) { return   a +  b  },
  sub: function (a, b) { return   a -  b  },
  lte: function (a, b) { return +(a <= b) },
  lt : function (a, b) { return +(a <  b) },
  mul: function (a, b) { return   a *  b  },
}

var test_if = `(fun (test t f) {if test t f})`
var recursive = `
(fun R (x N)
  (if (lte N 0) x (add 1 (R x (sub N 1))))
)
;;this recursive function could be converted into a loop.
;;actually it would be quite complicated. depends on the stack
;;to only apply an action on the way out. but it also
;;does (sub N 1) before recursing.
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
var tests = [
  [add_xyz, '(1 2 3)', null,  '(add 1 (add 2 3))'],
  [add_xyz, '(1 y 3)', null,  '(add 1 (add y 3))'],
  [add_xyz, '(a 2 3)', null,  '(add a (add 2 3))'],
  [add_xyz, '(1 2 3)', scope, '6'],
  [add_xyz, '(x 100 200)', scope, '(add x 300)'],
  [test_if, '(1 b c)', scope, 'b'],
  [test_if, '(0 b c)', scope, 'c'],
  [recursive, '(x 3)', scope, '(add 1 (add 1 (add 1 x)))'],
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

    /*
    try {
    } catch (err) {
      console.log(err)
      //it should be possible to come up with a way
      //to detect if a recursive function will inlinable.
      //hmm.
      //if it doesn't have any known args, it won't be.
      //if it doesn't have a path that doesn't have recursion
      //then it won't be (in fact, it will stackoverflow)
      //
      if(isRecursive(acid.parse(src)) && !output) t.ok(true)
      else {
        console.error('failed to inline:'+src)
        throw err
      }
    }*/

    console.log('time', Date.now()- start)
    console.log(output)
    if(output)
      t.equal(stringify(ast), output)
    t.end()
  })
})
