var {parseFun, isSymbol, isArray, isNumber, stringify} = require('../util')
var syms = require('../symbols')
var check = require('../types')
var s = check.types


//var args = [fun, [type..., ], [return_type...]]
//var sum = [Or, types...]
//var param [Type, params...]

var x = Symbol('x')

var scope = {
  add:         [[s.Int, s.Int],    [s.Int]],
  div:         [[s.Int, s.Int],    [s.Int]],
  concat:      [[s.List, s.List],  [s.List]],
  createArray: [[x],               [[s.Array, x]]],
  push:        [[[s.Array, x], x], [s.Int]],
  pop:         [[[s.Array, x]],    [x]],
  eq:          [[s.Int, s.Int],    [s.Bool]]
}

var acid = require('../')

var src1 = '(fun (a b) {add a b})'
var src2 = '(fun (a b) {if (eq b 0) (div a b) nil})'
var src3 = `(fun (a) (block
  (def ary (createArray Int))
  (push ary a)
  ary
))`


console.log(check(acid.parse(src1), [s.Int, s.Int], scope))
console.log(check(acid.parse(src2), [s.Int, s.Int], scope))
//the Type type, parameterized with an actual type? [s.Type, s.Int]
//sometimes a field is a particular known value already.
//maybe [s.Int, 7] means it's an int, it's 7.
///still figuring out how generics will work
//console.log(check(acid.parse(src3), [[s.Type, s.Int]], scope))
