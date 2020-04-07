var parse   = require('../parse')
var ev  = require('../eval')
var tape    = require('tape')
var u       = require('../util')
var inspect = require('util').inspect
var compileJs = require('../compile/js')
var compileWat = require('../compile/wat')
var wat2wasm = require('../wat2wasm')
var {
  isDefined, isSymbol, isArray,
  isDef, isEmpty, isFunction, isNumber, isBound,
  eqSymbol, equals, stringify
} = require('../util')

function sym2string (sym) {
  return sym.description
}

var env = {
  add: function ([a, b]) { return a + b },
  list: function (args) { return args },
  reduce: function ([list, iter, acc]) {
    return list.reduce((acc, item) => iter([acc, item]), acc)
  },
  get: function ([list, item]) {
    return list[item]
  },
  map: function ([list, fn]) {
    return list.map((v,i) => fn([v, i]))
  }
}

tape('free variables', function (t) {

  var fn = ev(parse('(fun fn (foo bar) (cat foo baz bar))'), {})
  console.log(fn)
  console.log(u.freeVariables(fn))

  t.deepEqual(u.freeVariables(fn).map(sym2string), ['cat', 'baz'])

  var ddd = function () {}
  ddd.source = parse('(fun ddd () null)')

  var fn = ev(parse('(fun fn (foo bar) (ddd foo baz bar))'), {ddd: ddd})
  console.log(inspect(fn, {depth: 10, colors: true}))
  t.deepEqual(u.freeVariables(fn).map(sym2string), ['baz'])

  //free variables doesn't include BOUND functions.
  var fn2 = ev(parse('(fun fn (foo bar) (ddd foo bar))'), {ddd: ddd})

  //should be completely flat
  console.log(u.stringify(u.unroll(fn2)))

  //functions evaled at load time, but everything is fully bound
  var ast = parse(`
  (block
    (def create {fun (x) [fun () x]})
    (def seven [create 7])
    seven)
  `)
  console.log("EVAL seven", stringify(ast))
  var seven = ev(ast, {})

  t.deepEqual(u.stringify(u.unroll(seven)), '(module (export (fun () 7)))')
  console.log("COMPILE.js", compileJs(u.unroll(seven)))
  console.log("COMPILE.wat", compileWat(u.unroll(seven)))

  // this example gets flattened to 7, because we can eval (suc x) and (add x 1)
  // without more data. This wouldn't work if suc wasn't pure.

  //uses binding, flattening
  var src = `
  (module
    (def suc {fun (x) [add x 1]})
    (def create {fun (x) [fun () (suc x)]})
    (def seven [create 6])
    seven)
  `
  var ast = parse(src)
  var seven2 = ev(ast, env)[4]
  t.deepEqual(u.stringify(u.unroll(seven2)), '(module (export (fun () 7)))')
  var fun7 = wat2wasm(compileWat(u.unroll(seven2)))
  t.deepEqual(fun7(), 7)

  console.log("-------------")

  var src2 = expand(parse(`
    (module
      (def suc {fun (x) [add x 1]})
      {fun (x) [suc [suc x]]}
    )
  `), {})
  
  var unrolled = u.unroll(src2.pop())
  console.log('SRC', unrolled)
//  t.deepEqual(u.stringify(unrolled), '(module (def suf (fun (x) (add x 1))) (export (fun () (suc (suc x)))))')
  console.log("CMP", compileWat(unrolled))
  var funD = wat2wasm(compileWat(unrolled))
  t.deepEqual(funD(3), 5)


//  var points = `
//  (module
//    (def point (struct {x: f64 y: f64}))
//    (def length {fun [(p point)] (sqrt (add (mul p.x p.x) (mul p.y p.y)))})
//  )`

  var src3 = expand(parse(`
    (module
      (def sum {fun [ary] (reduce ary add 0) })
      (export {fun [] (sum [list 1 2 3 4 5 6])})
    )
  `), env)

  var sum = src3.pop()[1]
  console.log("SRC3", sum)
  console.log('UROLL', u.unroll(sum)[1])
  var fun21 = wat2wasm(compileWat(u.unroll(sum)))
  console.log(fun21)
  t.equal(fun21(), 21)

  var src4 = expand(parse(`
    (module
      (def primes [list 2 3 5 7 11])
      (export {fun [] (get primes 3)})
    )
  `), env)

  console.log(u.unrollExports(src4))

  //a list,
  //map to an array of functions,
  //function that returns one of those functions
  //call that function (returning a number)
  //everything gets flattened!

  var src5 = expand(parse(`
    (module
      (def primes [list 2 3 5 7 11])
      (def get_primes (map primes {fun [v i] {fun () (get primes i)}}))
      (export {fun [] ((get get_primes 4)) })
    )
  `), env)
  console.log(src5)
  console.log(stringify(src5))

  t.end()

})
