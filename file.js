var fs = require('fs')

module.exports = function (file, block_size, flags) {
  var self
  var fd = fs.openSync(file, flags || 'r+')
  var offset = fs.statSync(file).size

  return self = {
    get: function (i, cb) {
      var buf = new Buffer(block_size)
      fs.read(fd, buf, 0, block_size, i*block_size, function (err, bytes_read) {
        cb(err, buf, bytes_read)
      })
    },
    size: function () { return offset },
    append: function (buf, cb) {
      fs.write(fd, buf, 0, buf.length, offset, function (err, written) {
        cb(null, offset = offset + written)
      })
    }
  }

}


