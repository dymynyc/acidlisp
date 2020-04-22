module.exports = function loadWasm(buf) {
  var m = new WebAssembly.Module(buf)
  var memory
  var instance = new WebAssembly.Instance(m, {
    system: {
       log: function (p) {
        console.error(memory.slice(p+4, p+4+memory.readUInt32LE(p)).toString())
        return p
      }
    }
  })

  if(instance.exports.memory)
    memory = Buffer.from(instance.exports.memory.buffer)

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
