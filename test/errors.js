
var recursive = `((fun R (n)
    (if (gte n 200) [fatal 3] (R (add n 1)))
  ) 0)`

var acid = require('../')

var tape = require('tape')

tape('throws', function (t) {
  try {
    acid.eval(`(block
      ;; do line numbers work?
      (fatal 1)
    )`, null, "EVAL1")
  } catch (err) { console.error(err) }

  try {
    acid.eval(recursive, null, "EVAL2")
  } catch (err) { console.error(err) }

  try {
    acid.eval(`(block
      ;; do line numbers work?
      (fatal 1)
    )`)
  } catch (err) { console.error(err) }
  t.end()
})
