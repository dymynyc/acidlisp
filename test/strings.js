var l6 = require('../')
var tape = require('tape')
var {stringify} = require('../util')
var inputs = [
  '(compare "abc" "abc")',
  '(compare "abc" "abd")',
  '(compare "abc" "abb")',
  '(concat "hello" ", world")',
  '(slice "hi there" 1 4)',
  `(block
    (def hmyj "hello mellow yellow jello")
    (def hello (slice hmyj 0 5))
    {join [list hello hello hello
      (concat "h" (slice hmyj 10 12))
      (slice hmyj 9 12)] " "})`
]

var outputs = [
  0,
  -1,
  1,
  Buffer.from('hello, world'),
  Buffer.from('i t'),
  Buffer.from('hello hello hello how low')
]

inputs.forEach(function (v, i) {
  tape(inputs[i] + ' => '+JSON.stringify(outputs[i].toString()), t => {
    t.equal(stringify(l6.eval(inputs[i])), stringify(outputs[i]))
    t.end()
  })
})
