
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
