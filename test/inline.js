
var tape = require('tape')
var parse = require('../parse')

var {
  isDefined, isSymbol, isArray,
  isDef, isEmpty, isFunction, isNumber, isBound,
  eqSymbol, equals, stringify, inline
} = require('../util')

var env = {
//  add: function ([a, b]) { return a + b }
}

tape('simple inline function', function (t) {

  var ast = parse(`
    [{fun [a] (add 1 a)} N]
  `)
  t.equal(stringify(inline(ast)), '(add 1 N)')

  var ast = parse(`
    [{fun [a b] (sqrt (add (mul a a) (mul b b)))} x y]
  `)
  t.equal(stringify(inline(ast)), '(sqrt (add (mul x x) (mul y y)))')

  t.end()
})
