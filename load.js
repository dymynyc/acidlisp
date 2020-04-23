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
function createImport (dir, env, cache) {
  if(!env) env = createEnv()
  cache = cache || {}
  return function (require) {
    if(Array.isArray(require)) require = require[0]
    if(Buffer.isBuffer(require))
      require = require.toString()
    else if(isNumber(require))
      require = readBuffer(env.memory, require).toString()
    var target = resolve(require, dir)
    if(cache[target]) return cache[target]
    return cache[target] = acid.eval(fs.readFileSync(target, 'utf8'), {
      import: createImport(path.dirname(target), env, cache),
      __proto__: env
    }, target)
  }
}

module.exports = createImport
