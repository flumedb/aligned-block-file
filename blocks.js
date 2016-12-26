var fs = require('fs')
/*
  Represent a file, as a table of buffers.
  copy from a range in the file into a buffer
  (may cross buffer boundries)

  Also, write into the file at any point.
  always update the cached buffer after the write.
  (always read a buffer before write, except for appending a new buffer)
*/

function assertInteger (a) {
  if(!Number.isInteger(a))
    throw new Error('expected positive integer, was:'+JSON.stringify(a))
}

var Cache = require('hashlru')

module.exports = function (file, block_size, cache) {
  var cbs = [], br
  cache = cache || Cache(1000)

  function get(i, cb) {
    if(Buffer.isBuffer(cache.get(i)))
      cb(null, cache.get(i), block_size)
    else if(Array.isArray(cbs[i]))
      cbs[i].push(cb)
    else {
      var buf = new Buffer(block_size)
      cbs[i] = [cb]
      file.get(i, function (err, buf, bytes_read) {
        var cb = cbs[i]
        //cache.set(i] = null
        cache.set(i, buf)
        while(cb.length) cb.shift()(err, buf, bytes_read)
      })
    }
  }

  function read(start, end, cb) {
    assertInteger(start);assertInteger(end)
    //check if start & end are part of the same buffer
    var i = ~~(start/block_size)

    var bufs = []
    ;(function next (i) {
      var block_start = i*block_size
      get(i, function (err, block, bytes_read) {
        if(err) return cb(err)
        //this is not right.
        if(bytes_read === 0) return cb(new Error('past end'), block, bytes_read)

        var read_start = start - block_start
        var read_end = Math.min(end - block_start, block_size)
        bufs.push(block.slice(read_start, read_end))
        start += (read_end - read_start)

        if(start < end) next(i+1)
        else cb(null, bufs.length == 1 ? bufs[0] : Buffer.concat(bufs), bytes_read)
      })
    })(i)

  }

  return br = {
    read: read,
    readUInt32BE: function (start, cb) {
      //TODO: avoid creating a buffer when not necessary?
      read(start, start+4, function (err, buf, bytes_read) {
        if(err) return cb(err)
        cb(null, buf.readUInt32BE(0))
      })
    },
    size: file && file.size,
    offset: file && file.offset,
    //starting to realize: what I really need is just a lib for
    //relative copies between two arrays of buffers, with a given offset.
    append: function (buf, cb) {
      //write to the end of the file.
      //if successful, copy into cache.
      file.offset.once(function (_offset) {

        var start = _offset
        var b_start = 0
        var i = ~~(start/block_size)
        while(b_start < buf.length) { //start < _offset+buf.length) {
          var block_start = i*block_size
          if(null == cache.get(i)) {
            var b = new Buffer(block_size)
            b.fill(0)
            cache.set(i, b)
          }

          if(Buffer.isBuffer(cache.get(i))) {
              var len = Math.min(block_size - (start - block_start), block_size)
              buf.copy(cache.get(i), start - block_start, b_start, b_start + len)
              start += len
              b_start += len
          }
          else if(Array.isArray(cbs[i]))
            throw new Error('should never happen: new block should be initialized, before a read ever happens')
          else
            start += block_size

          i++
        }

        file.append(buf, function (err, offset) {
          if(err) return cb(err)
          cb(null, offset)
        })
      })
    }
  }
}

