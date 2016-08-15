var fs = require('fs')

module.exports = function (file, block_size, flags) {
  var fd
  var offset = 0

  if(Number.isInteger(file))
    fd = file
  else
    fd = fs.openSync(file, flags || 'r+')

  return function (i, cb) {
    var buf = new Buffer(block_size)
    fs.read(fd, buf, 0, block_size, i*block_size, function (err, bytes_read) {
      cb(err, buf, bytes_read)
    })
  }

}

