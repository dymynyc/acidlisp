var fs = require('fs')
var path = require('path')
var parse = require('./parse')
var filename = path.join(__dirname, 'lib', 'memory.al')
var mem_ast = parse(fs.readFileSync(filename, 'utf8'), filename)
var ev = require('./eval')
var wrap = require('./wrap')
var {isBuffer, isArray} = require('./util')

module.exports = function (ast, env) {
  //initialize memory manager
  var mem = wrap(ev(mem_ast, env), env)
  var free = 0
  ;(function each (ast) {
    ast.forEach(function (v, i) {
      if(isBuffer(v)) {
        var ptr = mem.alloc(v.length + 4)
        env.memory.writeUInt32LE(v.length, ptr)
        v.copy(env.memory, 4+ptr)
        ast[i] = ptr
      }
      else if(isArray(v))
        each(v)
    })
  })(ast)

  return ast
}
