var expand = require('../')
var parse = require('../parse')
var inspect = require('util').inspect
var stringify = require('../util').stringify
function isNumber(n) {
  return 'number' === typeof n
}
function isFunction (f) {
  return 'function' === typeof f
}

var env = {
  //is this a good idea? collapse where possible?
  add: function (args, env) {
    if(args.every(isNumber))
    return args.reduce((a, b) => a + b, 0)
    else return [Symbol('add')].concat(args)
  },
  head: function (args) {
    return args[0][0]
  },
  tail: function (args) {
    return args[0].slice(1)
  },
  cat: function (args) {
    return args[0].concat(args[1])
  }
}
function isSymbol (s) {
  return 'symbol' === typeof s
}

var isArray = Array.isArray

function travducer (reduce) {
  return function R(acc, ast) {
    return isArray(ast) ? ast.reduce(R, acc) : reduce(acc, ast)
  }
}

var uniqueFns = travducer((acc, ast) => { if(isFunction(ast)) acc.add(ast); return acc })

var tape = require('tape')

var inputs = [
  '(module (def suc (fun (n) (add n 1))) (suc 37))',
  `{module [def fib
      {fun fib (n)
        (0) 1
        (1) 1
          [add {fib (add n -1)} {fib (add n -2)}]
      }]
      (fib 5)
  }`,
  `(module
      (def reverse (fun (l)
        (()) ()
          (cat (reverse (tail l)) (head l))))
      (reverse (1 2 3))
  )`,
  `(module
    (def create (fun (x) (fun () x)))
    (def seven (create 7))
    seven
  )`
/*
  // type is (size) (read pointer) (write pointer value)
  (def struct (props) {
    (block
      (def offset 0)
      (cat (map props (fun ([name type])
        (block
          (set offset (add offset type.size))
          { name : [
              read  : (ptr) -> (type.read (add ptr offset))
              write : (ptr value) -> (type.write (add ptr offset) value)
              size  : type.size
          ]  }
        )) [,size : offset])
    )
  })
  (def point {struct [x:f64 y:f64]})
*/
]

/*
ideas:
  inline a function so that it doesn't need a call, and can have closure scoped variables..
    (won't work for recursive closures)
  outline a closure by turning free variables into arguments.
*/

var outputs = [
  '38',
  '8',
  '(3 2 1)',
  '(fun () 7)'
]

inputs.forEach(function (v, i) {
  tape('expand:'+stringify(v), function (t) {
    var out = expand(parse(v), {__proto__: env})
    console.log("OUT", inspect(out, {depth: 10}))
    var funs = uniqueFns(new Set(), out).values()
    console.log(funs)
    t.equal(stringify(out.pop()), stringify(parse(outputs[i])))
    t.end()
  })
})
