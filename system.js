
function write(data, memory, start, bytes) {
  var toWrite = Math.min(bytes, data.length)
  data.copy(memory, start, 0, toWrite)
  if(data.length - toWrite > 0) {
    (queued[0] = queued[0] || [])
    .push(data.slice(toWrite))
  }
  return toWrite //bytes remaining
}

var queued = {}, in_read = false
module.exports = {
  memory: null, //needs to be set before
  read_request: function (id, start, bytes) {
    var self = this
    in_read = true
    console.error('read request', id, start, bytes)
    if(queued[id] && queued[id].length) {
      var data = queued[id].shift()
      //if we wrote already, return the number of bytes
      return write(data, self.memory, start, bytes)
    }

    var start = Date.now()
    if(id === 0)
      setTimeout(function () {
        process.stdin.once('data', function (data) {
          console.error('time', Date.now() - start)
          var written = write(data, self.memory, start, bytes)
          console.log('written', written, queued[0])
          self.exports.read_ready(id, start, written)
          //process.stdin.pause()
        }).resume()
    }, 20)
    
  }
}

process.stdin.on('end', function () {
  //tell wasm that stdin has closed
  console.log("stdin end")
  module.exports.exports.read_end(0, 0)
})
