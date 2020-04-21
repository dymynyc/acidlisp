#! /usr/bin/env node
var acid = require('./')
var path = require('path')
var fs = require('fs')
var createEnv = require('./env')
var createImport = require('./load')
var {
  pretty,stringify,isBuffer,isNumber,readBuffer
} = require('./util')

if(!module.parent) {
  var opts = require('minimist')(process.argv.slice(2))
  var env = createEnv(Buffer.alloc(65536), {0:0})
  var load = createImport(process.cwd(), env)
  var file = process.argv[2]
  if(!file)
    return console.error('acid {relative_path} > out.wat')
  //convert to a relative path
  if(!/^\.\.?\//.test(file)) file = './'+file

  if(opts.parse)
    console.log(pretty(acid.parse(fs.readFileSync(file, 'utf8'))))
  else if(opts.acid)
    console.log(pretty(require('./unroll')(load(file))))
  else if(opts.js)
    console.log(acid.js(load(file)), env)
  else
    console.log(acid.wat(load(file), env))
}
