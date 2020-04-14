#! /usr/bin/env node
var l6 = require('./')
var path = require('path')
var fs = require('fs')
var env = require('./env')
var resolve = require('./resolve')(
  'node_modules', '.l6', JSON.parse, 'package.json'
)
var {
  stringify,isBuffer,isNumber,readBuffer
} = require('./util')

var fs = require('fs')
function createImport (dir, env) {
  return function (require) {
    if(Array.isArray(require)) require = require[0]
    if(Buffer.isBuffer(require))
      require = require.toString()
    else if(isNumber(require))
      require = readBuffer(env.memory, require).toString()
    var target = resolve(require, dir)
    return l6.eval(fs.readFileSync(target, 'utf8'), {
      import: createImport(path.dirname(target), env),
      __proto__: env
    })
  }
}

module.exports = createImport

if(!module.parent) {
  var opts = require('minimist')(process.argv.slice(2))
  var load = createImport(process.cwd())
  var file = process.argv[2]
  if(!file)
    return console.error('l6 {relative_path} > out.wat')
  //convert to a relative path
  if(!/^\.\.?\//.test(file)) file = './'+file

  if(opts.parse)
    console.log(stringify(l6.parse(fs.readFileSync(file, 'utf8'))))
  else if(opts.l6)
    console.log(stringify(require('./unroll')(load(file))))
  else if(opts.js)
    console.log(l6.js(load(file)))
  else
    console.log(l6.wat(load(file)))
}
