var fs = require('fs')

/*
  Represent a file, as a table of buffers.
  copy from a range in the file into a buffer
  (may cross buffer boundries)

  Also, write into the file at any point.
  always update the cached buffer after the write.
  (always read a buffer before write, except for appending a new buffer)
*/

module.exports = function (file, block_size) {
  var blocks = [], offset = 0, br

  function get(i, cb) {
    if(Buffer.isBuffer(blocks[i]))
      cb(null, blocks[i], block_size)
    else if(Array.isArray(blocks[i]))
      blocks[i].push(cb)
    else {
      var buf = new Buffer(block_size)
      blocks[i] = [cb]
      file.get(i, function (err, buf, bytes_read) {
        var cbs = blocks[i]
        blocks[i] = buf
        if(bytes_read !== block_size)
          offset = (i*block_size) + bytes_read
        while(cbs.length) cbs.shift()(err, buf, bytes_read)
      })
    }
  }

  function read(start, end, cb) {
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
    blocks: blocks,
    read: read,
    readUInt32BE: function (start, cb) {
      //TODO: avoid creating a buffer when not necessary?
      read(start, start+4, function (err, buf) {
        if(err) return cb(err)
        cb(null, buf.readUInt32BE(0))
      })
    },
    size: file && file.size,
    //starting to realize: what I really need is just a lib for
    //relative copies between two arrays of buffers, with a given offset.

    append: function (buf, cb) {
      //write to the end of the file.
      //if successful, copy into cache.
      file.append(buf, function (err, offset) {
        if(err) return cb(err)
        var start = offset - buf.length
        br.offset = offset
        var b_start = 0
        var i = ~~(start/block_size)
        while(start < offset) {
          var block_start = i*block_size
          if(blocks[i]) {
              var write_start = start
              var write_end = Math.min(start - block_start, block_size)
              var len = block_size - (start - block_start)
              buf.copy(blocks[i], start - block_start, b_start, len)
              start += len
              b_start += len
          }
          else
            start += block_size

          i++
        }
        cb(null, offset)
      })
    }
  }
}




