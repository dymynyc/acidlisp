
exports.add = function (args) {
  return args.reduce((a,b) => a + b)
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
exports.isEmpty = function ([list]) {
  return list.length === 0
}
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
exports.compareAt = function ([buffer, start, end, _buffer, _start, _end]){
  return buffer.compare(_buffer, _start, _end, start, end)
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
