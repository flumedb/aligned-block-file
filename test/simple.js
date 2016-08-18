var fs = require('fs')

var Blocks = require('../blocks')
var File = require('../file')

var tape = require('tape')

var a = new Buffer(32)
a.fill('a')
var b = new Buffer(32)
b.fill('b')
var c = new Buffer(32)
c.fill('c')

tape('splice', function (t) {
  var bufs = Blocks(null, 32)
  bufs.blocks[0] = a
  bufs.blocks[1] = b
  bufs.blocks[2] = c
  bufs.offset = 96

  function test(start, end, expected) {
    bufs.read(start, end, function (err, actual) {
      if(err) throw err
      t.deepEqual(actual, expected)
    })
  }

  test(0, 32, a)
  test(32, 64, b)
  test(64, 96, c)

  test(0, 64, Buffer.concat([a, b]))
  test(32, 96, Buffer.concat([b, c]))

  var _a = a.slice(0, 16)
  var _b = b.slice(0, 16)
  var _c = c.slice(0, 16)

  test(16, 32 + 16, Buffer.concat([_a, _b]))
  test(32 + 16, 64 + 16, Buffer.concat([_b, _c]))

  t.end()
})

tape('read file', function (t) {
  var file = '/tmp/test_block-reader_'+Date.now()
  fs.appendFileSync(file, a)
  fs.appendFileSync(file, b)
  fs.appendFileSync(file, c)
  var bufs = Blocks(File(file, 32, 'a+'), 32)

  t.plan(7)

  function test(start, end, expected) {
    bufs.read(start, end, function (err, actual) {
      if(err) throw err
      t.deepEqual(actual, expected)
    })
  }

  test(0, 32, a)
  test(32, 64, b)
  test(64, 96, c)

  test(0, 64, Buffer.concat([a, b]))
  test(32, 96, Buffer.concat([b, c]))

  var _a = a.slice(0, 16)
  var _b = b.slice(0, 16)
  var _c = c.slice(0, 16)

  test(16, 32 + 16, Buffer.concat([_a, _b]))
  test(32 + 16, 64 + 16, Buffer.concat([_b, _c]))

})

tape('read empty file', function (t) {
  var file = '/tmp/test_block-reader_'+Date.now()
  var bufs = Blocks(File(file, 32, 'a+'), 32)
  bufs.read(0, 32, function (err, buf, bytes_read) {
    t.ok(err)
    t.equal(bytes_read, 0)
    t.end()
  })
})



