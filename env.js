var {isDefined} = require('./util')
module.exports = function (memory, globals, exports) {
  exports = exports || {}
  memory = memory || Buffer.alloc(0)
  globals = globals || {0:0}

  exports.add = function (args) {
    var r = args.reduce((a,b) => a + b)
    return r
  }
  exports.sub = function (args) {
    return args.reduce((a, b) => a - b)
  }
  exports.mul = function (args) {
    return args.reduce((a, b) => a * b)
  }
  exports.div = function (args) {
    return args.reduce((a, b) => a / b)
  }
  exports.mod = function ([a, b]) {
    return a % b
  }
  exports.pow = function ([a, b]) {
    return Math.pow(a, b)
  }
  exports.head = function ([list]) {
    return list[0]
  }
  exports.tail = function ([list]) {
    return list.slice(1)
  }
  exports.cat = function ([a,b]) {
    return a.concat(b)
  }
  exports.list = function (args) {
    return args
  }
  exports.is_empty = function ([list]) {
    return list.length === 0
  }

  exports.lt = function ([a, b]) {
    return +(a < b)
  }
  exports.lte = function ([a, b]) {
    return +(a <= b)
  }
  exports.gt = function ([a, b]) {
    return +(a > b)
  }
  exports.gte = function ([a, b]) {
    return +(a >= b)
  }
  exports.eq = function ([a, b]) {
    return +(a === b)
  }
  exports.neq = function ([a, b]) {
    return +(a !== b)
  }

  exports.fatal = function ([m]) {
    throw new Error(m)
  }

/*
  exports.concat = function (args) {
    return Buffer.concat(args)
  }
  exports.slice = function ([buffer, start, end]) {
    return buffer.slice(start, end)
  }
  exports.char = function ([buffer, index]) {
    return buffer[index]
  }
  exports.compare = function ([a, b]) {
    return a.compare(b)
  }
  exports.compare_at = function ([buffer, start, end, _buffer, _start, _end]){
    return buffer.compare(_buffer, _start, _end, start, end)
  }
  exports.equal_at = function ([buffer, start, _buffer, _start, length]){
    return 0 === buffer.compare(_buffer, _start, _start+length, start, start+length)
  }

  exports.join = function ([list, sep]) {
    var a = []
    for(var i = 0; i < list.length; i++) {
      a.push(list[i])
      a.push(sep)
    }
    a.pop() //remove last seperator
    return Buffer.concat(a)
  }
*/
  exports.set_global = function ([i, v]) {
    globals[i] = v
  }
  exports.get_global = function ([i]) {
    if(!isDefined(globals[i]))
      throw new Error('global['+i+'] is not defined')
    return globals[i]
  }

  exports.i32_load = function ([i]) {
    return memory.readUInt32LE(i)
  }
  exports.i32_store = function ([i, w]) {
    return memory.writeUInt32LE(w, i)
  }
  exports.i32_load8 = function ([i]) {
    return memory[i]
  }
  exports.i32_store8 = function ([i, w]) {
    return memory[i] = w
  }
  exports.globals = globals
  exports.memory = memory

  return exports
}
