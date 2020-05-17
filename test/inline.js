var tape = require('tape')
var acid = require('../')
var syms = require('../symbols')

var {
  isRecursive, isInlineable, getUsedVars, inline, loopify,
  inline_fun, inline_module
} = require('../inline')

var {
  isSymbol, isBasic, isDefined, isFunction, isArray, isCore,
  isNumber,
  stringify, pretty, parseFun
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
  gte: function (a, b) { return +(a >=  b) },
  mul: function (a, b) { return   a *   b  },
  neq: function (a, b) { return +(a !== b) },
  eq : function (a, b) { return +(a === b) },
  eqz: function (a   ) { return +(a === 0) },
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
//  [loop, '(10)', scope, '55']
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

/*
(fun fact (n) (if (eq 0 n) 1 (mul n (fact (sub n 1))))

(fun range (start end initial) (fun (reduce)
  ((fun R (acc i)
    (if (gte i end) (reduce acc i) (R (reduce acc i) (add i 1)))
  ) initial start)
))

((range 1 n 1) mul)

(fun (n) (block
  (def r 1)
  (loop (gt n 0)
    (set r (mul r n))
    (set n (sub n 1))
  )
  r
)
*/

tape('loopify inlineable', function (t) {
  var ast = acid.parse(recursive)
  //all values are known so we can just run the loop at compile time
  t.equal(stringify(loopify(ast, acid.parse('(7 10)'), scope)), '17')

  //in this test, the test is evalable, so the loop can be flattened.
  t.equal(stringify(loopify(ast, acid.parse('(x 5)'), scope)), 
    '(add 1 (add 1 (add 1 (add 1 (add 1 x)))))'
  )
  //x is mutated so must be a variable.
  t.equal(
    stringify(loopify(ast, acid.parse('(7 M)'), scope)),
    '(block (def x 7) (def N M) (loop (eqz (lte N 0)) (block (def x (add 1 x)) (def N (sub N 1))) x))')
  t.end()
})

tape('loopifyable, calling fun', function (t) {

  var R = acid.parse(`(fun R (acc i)
      (if (gte i end) (reduce acc i) (R (reduce acc i) (add i 1)))
    )`)
  t.equal(
    inline(R, [1, 1], {reduce: scope.mul, __proto__:  scope, end: {value:10}}),
    1*2*3*4*5*6*7*8*9*10
  )

  var reducer = acid.parse(`
    (fun (start end initial reduce) ((fun R (acc i)
      (if (gte i end) (reduce acc i) (R (reduce acc i) (add i 1)))
    ) initial start))`)

  t.equal(
    stringify(inline(reducer,
      acid.parse('(1 10 1 (fun (a b) (mul a b)))'),
      scope
    )),
    stringify(1*2*3*4*5*6*7*8*9*10)
  )

  t.equal(
    stringify(inline(reducer,
      acid.parse('(1 10 1 (fun (a b) (mul a b)))'),
      scope
    )),
    stringify(1*2*3*4*5*6*7*8*9*10)
  )

  //pass the args as a literal because then we can ref mul
  //like it would be if this code actually happened
  t.equal(
    stringify(inline(reducer,
      [1, 10, 1, scope.mul],
      scope
    )),
    stringify(1*2*3*4*5*6*7*8*9*10)
  )


  var reducer2 = acid.parse(`
    (fun (end)
      [(fun (start end initial reduce)
        [(fun R (acc i)
          (if (gte i end)
              (reduce acc i)
              (R (reduce acc i) (add i 1)) ))
        initial start])
      1 end 1 mul])`)

  t.equal(
    stringify(inline(reducer2,
      acid.parse('(11)'),
      scope
    )),
    stringify(1*2*3*4*5*6*7*8*9*10*11)
  )

  t.end()
})

tape('inline fun', function (t) {
  var ast = acid.parse(`(fun multiply (a b)
    ((fun (fn j k) (fn j k)) (fun (x y) (mul x y)) a b)
  )`)
  console.log(stringify(inline_fun(ast)))
  t.equal(stringify(inline_fun(ast)), '(bound_fun multiply (a b) (mul a b) )')
  t.end()
})
tape('inline module', function (t) {
  var m = acid.eval(`(module
    (def range (fun (end initial reduce)
      ((fun R (acc i)
        (if (lt i end) (R (reduce acc i) (add 1 i)) acc)
      ) initial 0)
    ))

    (def at (fun (p i) {i32_load (add p i)}))

    ;;checks if memory a...len is equal to b...len
    (export {fun [a b len]
      (range len 1
        (fun (acc i) (and acc (eq
              (at a (add a_start i))
              (at b (add b_start i)) ))))
    })
  )`)
  var _m = inline_module(m)
  t.equal(stringify(_m).indexOf('reduce'), -1)
  t.end()
})
