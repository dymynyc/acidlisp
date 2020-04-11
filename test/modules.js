var path = require('path')
var tape = require('tape')
var l6 = require('../')
var fs = require('fs')
var wrap = require('../wrap')
var env = require('../env')
//var unroll = require('../unroll')
//var compileJS = require('../compile/js')

var resolve = require('../resolve')(
  'node_modules', '.l6', JSON.parse, 'package.json'
)

console.log('resolve', resolve)
console.log(resolve('test', path.join(__dirname, 'examples')))

tape('import resolve tests', function (t) {
  var index        = 'index.l6'
  var modules      = path.join(__dirname, 'examples')
  var test_index   = path.join(modules, index)
  var node_modules = path.join(modules, 'node_modules')
  var foo_index    = path.join(node_modules, 'foo', index)
  var bar_bar      = path.join(node_modules, 'bar', 'bar.l6')

  t.equal(resolve('test',          modules), test_index)
  t.equal(resolve('test/index.l6', modules), test_index)
  t.equal(resolve('./index.l6',    modules), test_index)
  t.equal(resolve('foo',           modules), foo_index)
  t.equal(resolve('foo/index.l6',  modules), foo_index)

  t.throws(function () {
    //errors because outside of base dir
    resolve('../blah.l6', modules)
  })
  t.throws(function () {
    //absolute paths not allowed
    resolve(path.join(modules, index), modules)
  })
  //exception: this is allowed because foo doesn't have a package.json
  t.equal(
    resolve('../../index.l6', path.join(node_modules,'foo')),
    test_index
  )
  t.equal(resolve('bar/bar.l6', modules), bar_bar)
  console.log("BB", resolve('bar/bar.l6', modules))
  t.throws(function () {
    //errors because outside of base dir
    resolve('../../index.l6', path.join(node_modules,'bar'))
  })

  t.end()
})

tape('actually import stuff', function (t) {

  function createImport (dir) {
    return function ([require]) {
      var target = resolve(require, dir)
      return l6.eval(fs.readFileSync(target, 'utf8'), {
        import: createImport(path.dirname(target)),
        __proto__: env
      })
    }
  }

  var _import = createImport(path.join(__dirname, 'examples'))

  var raw = _import('./')

  function testWrapped(s, name) {
    console.log(name)
    t.equal(s.foofoo(), 27)
    t.equal(s.barbar(3), 16)
    t.equal(s.barbaz(3, 5), 15)
  }
  var s = wrap(raw, env)
  testWrapped(s, 'interpreter')
  testWrapped(l6.js_eval(raw), 'javascript')
  testWrapped(l6.wasm(raw), 'webassembly')

  t.end()
})
