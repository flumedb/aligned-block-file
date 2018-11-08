var fs = require('fs')
var mkdirp = require('mkdirp')
var Obv = require('obv')
var path = require('path')

module.exports = function (file, block_size, flags) {
  var self
  var fd = Obv()
  var offset = Obv()
  //fs.openSync(file, flags || 'r+')
  mkdirp(path.dirname(file), function () {
    fs.open(file, flags || 'r+', function (err, _fd) {
      fd.set(_fd || err)
      fs.stat(file, function (err, stat) {
        offset.set(err ? 0 : stat.size)
      })
    })
  })

  var writing = 0

  return self = {
    get: function (i, cb) {
      offset.once(function (_offset) {
        var max = ~~(_offset / block_size)
        if(i > max)
          return cb(new Error('aligned-block-file/file.get: requested block index was greater than max, got:'+i+', expected less than or equal to:'+max))

        var buf = new Buffer(block_size)
        buf.fill(0) //security

        fs.read(fd.value, buf, 0, block_size, i*block_size, function (err, bytes_read) {
          if(err) cb(err)
          else if(
            //if bytes_read is wrong
            i < max &&
            buf.length !== bytes_read &&
            //unless this is the very last block and it is incomplete.
            !((i*block_size + bytes_read) == offset.value)
          )
            cb(new Error(
              'aligned-block-file/file.get: did not read whole block, expected length:'+
              block_size+' but got:'+bytes_read
            ))
          else
            cb(null, buf, bytes_read)
        })
      })
    },
    offset: offset,
    size: function () { return offset.value },
    append: function (buf, cb) {
      if(writing++) throw new Error('already writing to this file')
      fd.once(function (_fd) {
        if('object' === typeof _fd)
          return cb(_fd)
        offset.once(function (_offset) {
          fs.write(_fd, buf, 0, buf.length, _offset, function (err, written) {
            writing = 0
            if(err) return cb(err)
            if(written !== buf.length) return cb(new Error('wrote less bytes than expected:'+written+', but wanted:'+buf.length))
            offset.set(_offset+written)
            cb(null, _offset+written)
          })
        })
      })
    },
    truncate: function (len, cb) {
      if(writing++) throw new Error('already writing, cannot truncate')
      fd.once(function (_fd) {
        if('object' === typeof _fd)
          return cb(_fd)
        offset.once(function (_offset) {
          if(_offset <= len) return cb()
          fs.ftruncate(_fd, len, function (err) {
            if(err) cb(err)
            else {
              offset.set(len)
              cb(null, offset.value)
            }
          })
        })
      })
    }
  }
}

