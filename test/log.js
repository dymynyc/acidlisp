
var log = require('../require')(__dirname, null, {
  system: {log: console.log.bind(console) }
})('./examples/log')

log(4)
