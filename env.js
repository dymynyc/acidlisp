var {isDefined} = require('./util')
module.exports = function (memory, globals, exports) {
  exports = exports || {}
  memory = memory || Buffer.alloc(0)
  globals = globals || {0:0}

  exports.add = function (...args) {
    var r = args.reduce((a,b) => a + b)
    return r
  }
  exports.sub = function (...args) {
    return args.reduce((a, b) => a - b)
  }
  exports.mul = function (...args) {
    return args.reduce((a, b) => a * b)
  }
  exports.div = function (...args) {
    return args.reduce((a, b) => a / b)
  }
  exports.mod = function (a, b) {
    return a % b
  }
  exports.pow = function (a, b) {
    return Math.pow(a, b)
  }
  exports.head = function (list) {
    return list[0]
  }
  exports.tail = function (list) {
    return list.slice(1)
  }
  exports.cons = function (a, b) {
    return [a].concat(b)
  }
  exports.cat = function (a, b) {
    return a.concat(b)
  }
  exports.list = function (args) {
    return args
  }
  exports.is_empty = function (list) {
    return +(list.length === 0)
  }

  exports.lt = function (a, b) {
    return +(a < b)
  }
  exports.lte = function (a, b) {
    return +(a <= b)
  }
  exports.gt = function (a, b) {
    return +(a > b)
  }
  exports.gte = function (a, b) {
    return +(a >= b)
  }
  exports.eq = function (a, b) {
    return +(a === b)
  }
  exports.neq = function (a, b) {
    return +(a !== b)
  }

  exports.fatal = function (m) {
    throw new Error(m)
  }

  exports.set_global = function (i, v) {
    globals[i] = v
  }
  exports.get_global = function (i) {
    if(!isDefined(globals[i]))
      throw new Error('global['+i+'] is not defined')
    return globals[i]
  }

  exports.i32_load = function (i) {
    return memory.readUInt32LE(i)
  }
  exports.i32_store = function (i, w) {
    return memory.writeUInt32LE(w, i)
  }
  exports.i32_load8 = function (i) {
    return memory[i]
  }
  exports.i32_store8 = function (i, w) {
    return memory[i] = w
  }

  exports.globals = globals
  exports.memory = memory

  return exports
}
