var path = require('path')
var tape = require('tape')

var load = require('../resolve')(
  'node_modules', '.l6', JSON.parse, 'package.json'
)

console.log(load('test', path.join(__dirname, 'examples')))

tape('import resolve tests', function (t) {
  var index = 'index.l6'
  var modules = path.join(__dirname, 'examples')
  var test_index = path.join(modules, index)
  var node_modules = path.join(modules, 'node_modules')
  var foo_index = path.join(node_modules, 'foo', index)
  var bar_bar = path.join(node_modules, 'bar', 'bar.l6')

  t.equal(load('test', modules), test_index)
  t.equal(load('test/index.l6', modules), test_index)
  t.equal(load('./index.l6', modules), test_index)
  t.equal(load('foo', modules), foo_index)
  t.equal(load('foo/index.l6', modules), foo_index)

  t.throws(function () {
    //errors because outside of base dir
    load('../blah.l6', modules)
  })
  t.throws(function () {
    //absolute paths not allowed
    load(path.join(modules, index), modules)
  })
  //exception: this is allowed because foo doesn't have a package.json
  t.equal(
    load('../../index.l6', path.join(node_modules,'foo')),
    test_index
  )
  t.equal(load('bar/bar.l6', modules), bar_bar)
  t.throws(function () {
    //errors because outside of base dir
    load('../../index.l6', path.join(node_modules,'bar'))
  })

  t.end()
})
