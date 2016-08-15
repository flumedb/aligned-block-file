var fs = require('fs')

module.exports = function (file, block_size) {
  var blocks = [], offset = 0

  function get(i, cb) {
    if(Buffer.isBuffer(blocks[i]))
      cb(null, blocks[i])
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
        while(cbs.length) cbs.shift()(err, buf)
      })
    }
  }

  function read(start, end, cb) {
    //check if start & end are part of the same buffer
    var i = ~~(start/block_size)

    var bufs = []
    ;(function next (i) {
      var block_start = i*block_size
      get(i, function (err, block) {
        if(err) return cb(err)

        var read_start = start - block_start
        var read_end = Math.min(end - block_start, block_size)

        bufs.push(block.slice(read_start, read_end))
        start += (read_end - read_start)

        if(start < end) next(i+1)
        else cb(null, bufs.length == 1 ? bufs[0] : Buffer.concat(bufs))
      })
    })(i)

  }

  return {
    fd: file.fd,
    blocks: blocks,
    read: read,
    readUInt32BE: function (start, cb) {
      //TODO: avoid creating a buffer when not necessary?
      read(start, start+4, function (err, buf) {
        if(err) return cb(err)
        console.log("READ", buf, start, blocks)
        cb(null, buf.readUInt32BE(0))
      })
    },
    size: function (cb) {
      fs.stat(fd, function (err, stat) {
        if(err) return cb(err)
        else cb(null, stat.size)
      })
    },
    truncate: function (i, cb) {
      //if there are buffers stored greater than this,
      //clear them. zero the rest of the last buffer, if it overlaps.
      fs.truncate(fd, i, cb)
    },
    //starting to realize: what I really need is just a lib for
    //relative copies between two arrays of buffers, with a given offset.

    append: function (buf, cb) {
      //write to the end of the file.
      //if successful, copy into cache.
      file.append(buf, function (err, offset) {
        if(err) return cb(err)
        var start = offset - buf.length
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
















