var parse = require('../parse')
var refs = require('../references')

var inputs = [
  '(block (def foo 1) (fun (a b) { add foo a }))',
  '(block (def foo 1) (quote (fun (a b) { add foo a })))',

]

inputs.forEach(v => {
  console.log(v = parse(v))
  var map = refs(v)
  console.log(map)
  console.log(refs.dump(v, map))
})
