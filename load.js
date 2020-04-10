#! /usr/bin/env node
var l6 = require('./')
var path = require('path')
var fs = require('fs')
var env = require('./env')
var resolve = require('./resolve')(
  'node_modules', '.l6', JSON.parse, 'package.json'
)

var fs = require('fs')
function createImport (dir) {
  return function (require) {
    if(Array.isArray(require)) require = require[0]
    var target = resolve(require, dir)
    return l6.eval(fs.readFileSync(target, 'utf8'), {
      import: createImport(path.dirname(target)),
      __proto__: env
    })
  }
}

module.exports = createImport

if(!module.parent) {
  var load = createImport(process.cwd())
  var file = process.argv[2]
  if(file)
    return console.error('l6 {relative_path} > out.wat')
  //convert to a relative path
  if(!/^\.\.?\//.test(file)) file = './'+file
  console.log(l6.wat(load(file)))
}
