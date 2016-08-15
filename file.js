var fs = require('fs')

module.exports = function (file, block_size, flags) {
  var fd
  var offset = 0

  if(Number.isInteger(file))
    fd = file
  else
    fd = fs.openSync(file, flags || 'r+')

  return {
    fd: fd,
    get: function (i, cb) {
      var buf = new Buffer(block_size)
      fs.read(fd, buf, 0, block_size, i*block_size, function (err, bytes_read) {
        cb(err, buf, bytes_read)
      })
    },
    append: function (buf, cb) {
      if(!offset)
        fs.stat(file, function (err, stat) {
          if(err) return cb(err)
          offset = stat.size
          write()
        })
      else write()

      function write() {
        fs.write(fd, buf, 0, buf.length, offset, function (err, written) {
          console.log(err, written)
          cb(null, offset = offset + written)
        })
      }
    }
  }

}

