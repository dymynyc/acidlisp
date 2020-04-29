module.exports = function loadWasm(buf, imports) {
  var m = new WebAssembly.Module(buf)
  var memory
  var sys = require('./system')
  var instance = new WebAssembly.Instance(m, imports || {})

  sys.exports = instance.exports

  if(instance.exports.memory)
    memory = Buffer.from(instance.exports.memory.buffer)
  sys.memory = memory
  if(instance.exports.ready)
    instance.exports.ready()

  if(instance.exports.main){
    instance.exports.main.memory = memory
    function main () {
      return instance.exports.main.apply(null, [].slice.call(arguments))
    }
    main.memory = memory
    return main
  }
  else {
    var o = {}
    for(var k in instance.exports)
      o[k] = instance.exports[k]
    o.memory = memory
    return o
  }
}
