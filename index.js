var File = require('./file')
var Blocks = require('./blocks')

module.exports = function (file, block_size, flags) {
  return Blocks(File(file, block_size, flags), block_size)
}
