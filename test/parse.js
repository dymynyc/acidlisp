var assert = require('assert')
var parse = require('../parse')
var valid = [
  '(foo bar baz)',
  '(foo [bar baz])',
  '(foo [bar {baz}])',
  '[]',
  '()',
  '(1 2 3 [4 5 6])',
  'foo : bar',
  '(foo bar) : baz',
  '(&foo bar)',
  'foo.bar.baz'
]

var invalid = [
  '(foo bar ]',
  'foo : bar : baz'
]

valid.forEach(function (e) {
  console.log('valid:', e)
  var v = parse(e)
  assert.ok(v, 'could parse:'+e)
  console.log('==>', v)
})
invalid.forEach(function (e) {
  console.log('invalid:', e)
  assert.throws(()=>parse(e), 'should not parse:'+e)
})
