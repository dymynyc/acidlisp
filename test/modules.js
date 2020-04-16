var path = require('path')
var tape = require('tape')
var acid = require('../')
var fs = require('fs')
var wrap = require('../wrap')
var createEnv = require('../env')
//var unroll = require('../unroll')
//var compileJS = require('../compile/js')

var resolve = require('../resolve')(
  'node_modules', '.al', JSON.parse, 'package.json'
)

console.log('resolve', resolve)
console.log(resolve('test', path.join(__dirname, 'examples')))

tape('import resolve tests', function (t) {
  var index        = 'index.al'
  var modules      = path.join(__dirname, 'examples')
  var test_index   = path.join(modules, index)
  var node_modules = path.join(modules, 'node_modules')
  var foo_index    = path.join(node_modules, 'foo', index)
  var bar_bar      = path.join(node_modules, 'bar', 'bar.al')

  t.equal(resolve('test',          modules), test_index)
  t.equal(resolve('test/index.al', modules), test_index)
  t.equal(resolve('./index.al',    modules), test_index)
  t.equal(resolve('foo',           modules), foo_index)
  t.equal(resolve('foo/index.al',  modules), foo_index)

  t.throws(function () {
    //errors because outside of base dir
    resolve('../blah.al', modules)
  })
  t.throws(function () {
    //absolute paths not allowed
    resolve(path.join(modules, index), modules)
  })
  //exception: this is allowed because foo doesn't have a package.json
  t.equal(
    resolve('../../index.al', path.join(node_modules,'foo')),
    test_index
  )
  t.equal(resolve('bar/bar.al', modules), bar_bar)
  console.log("BB", resolve('bar/bar.al', modules))
  t.throws(function () {
    //errors because outside of base dir
    resolve('../../index.al', path.join(node_modules,'bar'))
  })

  t.end()
})

tape('actually import stuff', function (t) {

  var createImport = require('../load')
  var env = createEnv(Buffer.alloc(65536), {0:0})
  var _import = createImport(path.join(__dirname, 'examples'), env)

  var raw = _import('./')

  function testWrapped(s, name) {
    console.log(name)
    t.equal(s.foofoo(), 27)
    t.equal(s.barbar(3), 16)
    t.equal(s.barbaz(3, 5), 15)
  }
  var s = wrap(raw, env)
//  testWrapped(s, 'interpreter')
//  testWrapped(acid.js_eval(raw), 'javascript')
  testWrapped(acid.wasm(raw), 'webassembly')

  t.end()
})
