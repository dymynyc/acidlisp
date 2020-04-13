var assert  = require('assert')
var parse   = require('../parse')
var tape    = require('tape')
var inspect = require('util').inspect

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
  'foo.bar.baz',
  '(foo bar ;;comment \n baz)'
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
  var passed = false
  try {
    parse(e)
  } catch (err) {
    passed = true
    console.log(err)
    assert.ok(err)
  }
  assert.ok(true)
})

var strings = [
  '"foo"',
  '"zeros\\00"',
  //unlike js strings, wat strings are double quote only
  //but still must escape single quotes!
  '"\\"foo\\""',
  '"\\\'foo\\\'"',
  '"\\n\\t\\r"',
  //I think this must always be even number of hexdigits
  //but upper and lower case a-f is okay.
  //this is the same as js string unicode.
  '"\\u{01F4A9}"',
  '"\\u{01f4a9}"'
]

var buffers = [
  Buffer.from('foo'),
  Buffer.concat([Buffer.from('zeros'), Buffer.from([0])]),
  Buffer.from('"foo"'),
  Buffer.from("'foo'"),
  Buffer.from('\n\t\r'),
  Buffer.from('\u{1F4A9}'),
  Buffer.from('\u{1f4a9}')
]

strings.forEach(function (input, i) {
  tape(input+' => '+inspect(buffers[i].toString()), function (t) {
    
    t.deepEqual(parse.string(input, 0).groups[0], Buffer.from(buffers[i]))
    t.end()
  })
})
