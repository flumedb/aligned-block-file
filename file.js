var fs = require('fs')
var mkdirp = require('mkdirp')
var Obv = require('obv')
var path = require('path')

module.exports = function (file, block_size, flags) {
  flags = flags || 'r+'
  var fd
  var offset = Obv()

  // Positional read and write operations may be hazardous. We want to avoid:
  //
  // - Concurrent writes to the same part of the file.
  // - Reading and writing from the same part of the file.
  //
  // It's possible (likely?) that Node.js handles this deeper in the stack,
  // especially since it seems to use `pread()` and `pwrite()`. Removing this
  // queue system doesn't break any tests, but I'm not confident enough to
  // remove it until we confirm that Node.js handles concurrent positional
  // reads and writes without either of the concurrency problems above.
  //
  // This async queue system is made of four parts:
  //
  // - `busy`: A boolean semaphore for positional reads and writes to `fd`.
  // - `queue`: An array of functions that want to access `fd`.
  // - `todo(fn)`: Used to run or queue `fn`, which must call `release()`.
  // - `release()`: Called by functions passed to `todo()` after using `fd`.

  // If `busy === true` then another function is accessing `fd`.
  // If `busy === false` then you're all clear to access.
  let busy = false

  // Each item should be a function that accepts no arguments.
  // `release()` should be called as soon as `fd` access is complete.
  // Items are processed FIFO even though `Array.shift()` is slow
  const queue = []


  // A function passed to `todo` will have exclusive access to positional 
  // operations on `fd`, although append operations may still occur.
  //
  // Any function passed to `todo()` absolutely *must* call `release()` when
  // finished using `fd`, often as the first line in the `fs.foo()` callback.
  const todo = (fn) => {
    if (busy === true) {
      queue.push(fn)
    } else {
      busy = true
      fn()
    }
  }

  const release = () => {
    if (queue.length === 0) {
      busy = false
    } else {
      queue.shift()()
    }
  }

  mkdirp(path.dirname(file), function () {
    //r+ opens the file for reading and writing, but errors if file does not exist.
    //to open the file for reading and writing and not error if it does not exist.
    //we need to open and close the file for append first.
    fs.open(file, 'a', function (_, _fd) {
      fs.close(_fd, function (_) {
        fs.open(file, flags, function (err, _fd) {
          fd = _fd
          fs.stat(file, function (err, stat) {
            offset.set(err ? 0 : stat.size)
          })
        })
      })
    })
  })

  // This variable *only* tracks appends, not positional writes.
  var appending = 0

  return {
    get: function (i, cb) {
      offset.once(function (_offset) {
        function onReady () {
          var max = ~~(_offset / block_size)
          if(i > max)
            return cb(new Error('aligned-block-file/file.get: requested block index was greater than max, got:'+i+', expected less than or equal to:'+max))

          var buf = Buffer.alloc(block_size)

          fs.read(fd, buf, 0, block_size, i*block_size, function (err, bytes_read) {
            release()
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
        }
        todo(onReady)
      })
    },
    offset: offset,
    size: function () { return offset.value },
    append: function (buf, cb) {
      if(appending++) throw new Error('already appending to this file')
      offset.once(function (_offset) {
        fs.write(fd, buf, 0, buf.length, _offset, function (err, written) {
          appending = 0
          if(err) return cb(err)
          if(written !== buf.length) return cb(new Error('wrote less bytes than expected:'+written+', but wanted:'+buf.length))
          offset.set(_offset+written)
          cb(null, _offset+written)
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
      if(flags !== 'r+') throw new Error('file opened with flags:'+flags+' refusing to write unless flags are:r+')
      offset.once((_offset) => {
        const endPos = pos + buf.length
        const isPastOffset = endPos > _offset

        if (isPastOffset) {
          return cb(new Error(`cannot write past offset: ${endPos} > ${_offset}`))
        }

        function onReady () {
          fs.write(fd, buf, 0, buf.length, pos, (err, written) => {
            release()
            if (err == null && written !== buf.length) {
              cb(new Error('wrote less bytes than expected:'+written+', but wanted:'+buf.length))
            } else {
              cb(err)
            }
          })
        }

        todo(onReady)
      })
    },
    truncate: function (len, cb) {
      if(appending) throw new Error('already appending, cannot truncate')
      offset.once(function (_offset) {
        if(_offset <= len) return cb()
        fs.ftruncate(fd, len, function (err) {
          if(err) cb(err)
          else {
            offset.set(len)
            cb(null, offset.value)
          }
        })
      })
    }
  }
}


