
var m = '(module (export (fun () [fatal 1])) )'

var acid = require('../')

var tape = require('tape')

tape('throws', function (t) {
  t.throws(function () {
    acid.wasm(m)()
  })
  t.end()
})
