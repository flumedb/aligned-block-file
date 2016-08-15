var fs = require('fs')

module.exports = function (get_block, block_size) {
  var blocks = []

  function get(i, cb) {
    if(Buffer.isBuffer(blocks[i]))
      cb(null, blocks[i])
    else if(Array.isArray(blocks[i]))
      blocks[i].push(cb)
    else {
      var buf = new Buffer(block_size)
      blocks[i] = [cb]
      get_block(i, function (err, buf, bytes_read) {
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
    blocks: blocks,
    read: read,
  }
}

