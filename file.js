var fs = require('fs')
var mkdirp = require('mkdirp')
var Obv = require('obv')
var path = require('path')

module.exports = function (file, block_size, flags) {
  var fd = Obv()
  var offset = Obv()
  var writing = Obv().set(false)
  //fs.openSync(file, flags || 'r+')
  mkdirp(path.dirname(file), function () {
    fs.open(file, flags || 'r+', function (err, _fd) {
      fd.set(_fd || err)
      fs.stat(file, function (err, stat) {
        offset.set(err ? 0 : stat.size)
      })
    })
  })

  var appending = 0

  return {
    get: function (i, cb) {
      offset.once(function (_offset) {
        writing(function (_writing) {
          if (_writing === true) {
            return
          } else {
            this()
          }


          var max = ~~(_offset / block_size)
          if(i > max)
            return cb(new Error('aligned-block-file/file.get: requested block index was greater than max, got:'+i+', expected less than or equal to:'+max))

          var buf = Buffer.alloc(block_size)

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
      })
    },
    offset: offset,
    size: function () { return offset.value },
    append: function (buf, cb) {
      if(appending++) throw new Error('already appending to this file')
      fd.once(function (_fd) {
        if('object' === typeof _fd)
          return cb(_fd)
        offset.once(function (_offset) {
          fs.write(_fd, buf, 0, buf.length, _offset, function (err, written) {
            appending = 0
            if(err) return cb(err)
            if(written !== buf.length) return cb(new Error('wrote less bytes than expected:'+written+', but wanted:'+buf.length))
            offset.set(_offset+written)
            cb(null, _offset+written)
          })
        })
      })
    },
    /**
     * Writes a buffer directly to a position in the file. This opens the file
     * with another file descriptor so that the main file descriptor can just
     * append and read without doing any positional writes.
     *
     * @param {buffer} buf - the data to write to the file
     * @param {number} pos - position in the file to write the buffer
     * @param {function} cb - callback that returns any error as an argument
     */
    write: (buf, pos, cb) => {
      offset.once((_offset) => {
        const endPos = pos + buf.length
        const isPastOffset = endPos > _offset

        if (isPastOffset) {
          return cb(new Error(`cannot write past offset: ${endPos} > ${_offset}`))
        }

        writing(function (_writing) {
          if (_writing === true) {
            return
          } else {
            this()
            writing.set(true)
          }

          fs.open(file, 'r+', function (err, writeFd) {
            fs.write(writeFd, buf, 0, buf.length, pos, (err, written) => {
              writing.set(false)
              if (err == null && written !== buf.length) {
                cb(new Error('wrote less bytes than expected:'+written+', but wanted:'+buf.length))
              } else {
                cb(err)
              }
            })
          })
        })
      })
    },
    truncate: function (len, cb) {
      if(appending++) throw new Error('already appending, cannot truncate')
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

