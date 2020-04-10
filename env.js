
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
