
var m = '(module (export (fun () [fatal 1])) )'

var l6 = require('../')

var tape = require('tape')

tape('throws', function (t) {
  t.throws(function () {
    l6.wasm(m)()
  })
  t.end()
})
