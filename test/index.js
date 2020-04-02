var expand = require('../')
var parse = require('../parse')

function isNumber(n) {
  return 'number' === typeof n
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

function stringify (s) {
  if(isArray(s)) return '(' + s.map(stringify).join(' ') + ')'
  if(isSymbol(s)) return s.description
  return JSON.stringify(s)
}


var tape = require('tape')

var inputs = [
  '(module (def suc (fun (n) (add n 1))) (suc 37))',
  `{module [def fib
      {fun (n)
        (0) 1
        (1) 1
          (add (fib (add n -1)) (fib (add n -2)))
      }]
      (fib 5)
  }`,
  `(module
      (def reverse (fun (l)
        (()) ()
          (cat (reverse (tail l)) (head l))))
      (reverse (1 2 3))
  )`
]

var outputs = [
  '(module 38)',
  '(module 8)',
  '(module (3 2 1))'
]

inputs.forEach(function (v, i) {
  tape('expand:'+stringify(v), function (t) {
    t.equal(stringify(expand(parse(v), {__proto__: env})), stringify(parse(outputs[i])))
    t.end()
  })
})
