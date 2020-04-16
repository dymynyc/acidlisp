var tape = require('tape')
var acid = require('../')

var basic = `
(module
  (export get {fun [ptr] (i32_load ptr)})
  (export set {fun [ptr value] (i32_store ptr value)})
  (export set2 {fun [ptr value value2]
    (block
      (i32_store ptr value)
      (i32_store (add ptr 4) value2))}))`


function testRandom(m, t) {
  for(var i = 0; i < 100; i++) {
    var p = ~~(Math.random()*10000)
    var r = ~~(Math.random()*10000)
    m.set(p, r)
    t.equal(m.get(p), r)
  }
}

tape('basic, wasm', function (t) {
  testRandom(acid.wasm(basic), t)
  t.end()
})

tape('basic, js', function (t) {
  console.log(acid.js(basic))
  testRandom(acid.js_eval(basic), t)
  t.end()
})


//still some work to  do to get this to run.
var structs =
`
(module
  (def i32 [list
    &get  : (fun (ptr) (i32.load ptr))
    &set  : (fun (ptr value) (i32.store ptr value))
    &size : 4
  ])

  (def struct (fun (args start)
    [block
      (def key args.0)
      (def type args.1)
      (def size (add start type.size))
      (if
        (isEmpty args) ()
        {cat [list
          &get  : {fun (ptr)       (type.get (add ptr size)}
          &set  : {fun (ptr value) (type.set (add ptr size) value)}
          &size : size  ;; should it use the size for just this field?
          ] (struct (tail args) size)})]))

  (def Point (struct [list x:i32 y:i32] 0))

  (export load (fun (x) (i32.load 0))
  (export store (fun (x) (i32.store 0 x))
)
`
