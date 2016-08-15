


var tape = require('tape')
var Blocks = require('../blocks')
var File = require('../file')

var filename = '/tmp/test_block-reader_'+Date.now()
var blocks = Blocks(File(filename, 32, 'a+'), 32)

var a = new Buffer(32)
a.fill('a')

var b = new Buffer(32)
b.fill('b')

var c = new Buffer(32)
c.fill('c')

tape('append one block', function (t) {

  blocks.append(a, function (err, offset) {
    if(err) throw err
    t.equal(offset, 32)
    t.end()
  })

})


tape('append another block', function (t) {

  blocks.append(b, function (err, offset) {
    if(err) throw err
    t.equal(offset, 64)
    t.end()
  })

})

tape('append a half block', function (t) {

  blocks.append(c.slice(0, 16), function (err, offset) {
    if(err) throw err
    t.equal(offset, 80)
    t.end()
  })

})

tape('read last block', function (t) {
  blocks.read(64, 96, function (err, _c) {
    if(err) throw err
    console.log(_c)
    t.deepEqual(_c.slice(0, 16), c.slice(0, 16))
    t.end()
  })
})

tape('append another half block', function (t) {
  blocks.append(c.slice(0, 16), function (err, offset) {
    if(err) throw err
    t.equal(offset, 96)

    blocks.read(64, 96, function (err, _c) {
      if(err) throw err
      console.log(_c)
      t.deepEqual(_c, c)
      t.end()
    })

  })
})

