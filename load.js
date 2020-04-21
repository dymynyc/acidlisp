#! /usr/bin/env node
var acid = require('./')
var path = require('path')
var fs = require('fs')
var createEnv = require('./env')
var resolve = require('./resolve')(
  'node_modules', '.al', JSON.parse, 'package.json'
)
var {
  pretty,stringify,isBuffer,isNumber,readBuffer
} = require('./util')

var fs = require('fs')
function createImport (dir, env) {
  if(!env) env = createEnv()
  return function (require) {
    if(Array.isArray(require)) require = require[0]
    if(Buffer.isBuffer(require))
      require = require.toString()
    else if(isNumber(require))
      require = readBuffer(env.memory, require).toString()
    var target = resolve(require, dir)
    return acid.eval(fs.readFileSync(target, 'utf8'), {
      import: createImport(path.dirname(target), env),
      __proto__: env
    })
  }
}

module.exports = createImport
