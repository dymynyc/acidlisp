
var load = require('../load')(__dirname)
var l6 = require('../')

var m = l6.wasm(load('./bench'))
console.log(m)


var start = Date.now()
  m.calls()
console.log(Date.now() - start)

var start = Date.now()
  m.inlines()
console.log(Date.now() - start)

var start = Date.now()
  m.unrolled()
console.log(Date.now() - start)
