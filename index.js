module.exports = {
  TransformToBulk: require('./lib/transform-to-bulk.js'),
  WritableBulk   : require('./lib/writable-bulk'),
  ReadableSearch : require('./lib/readable-search'),
  PipableDocs    : require('./lib/transform-mget')
};