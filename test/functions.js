var tape = require('tape')
var parse = require('../parse')
var ev = require('../eval')
var compileWat = require('../compile/wat')
var compileJs = require('../compile/js')
var wat2wasm = require('../wat2wasm')
var stringify = require('../util').stringify
var flatten = require('../flatten')

var env = {}

var inputs = [
` {module
    (def create {fun (x) [fun () x]})
    (def seven (create 7))
    (export seven)}`
]

var outputs = [
  7
]

inputs.forEach(function (v, i) {
  tape('compile functions:'+inputs[i], function (t) {
    var ast = ev(parse(inputs[i]), env)
    console.log('AST', ast)

    t.end()
  })
})
