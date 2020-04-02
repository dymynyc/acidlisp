var assert = require('assert')
var _parse = require('../parse')
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

function parse (s) {
  var o = _parse(s, 0)
  if(o.length != s.length) {
    console.log(o)
    throw new Error('failed to parse fully:')
  }
  return o.groups
}

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
