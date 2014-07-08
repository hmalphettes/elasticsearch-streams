/**
 * Transform a stream of documents into a stream of bulk commands to index them.
 * This is more an example than anything else.
 */
'use strict';
var Transform = require('stream').Transform;

module.exports = TransformToBulk;

/**
 * @param getIndexTypeId function that is passed a document and returns:
 *            { _index: the_index?, _type: the_type?, _id: the_id? }
 */
function TransformToBulk(getIndexTypeId) {
  if (!(this instanceof TransformToBulk)) {
    return new TransformToBulk(getIndexTypeId);
  }
  Transform.call(this, {objectMode:true});
  this.getIndexTypeId = getIndexTypeId;
}

TransformToBulk.prototype = Object.create(Transform.prototype, {constructor: {value: TransformToBulk}});

TransformToBulk.prototype._transform = function(chunk, encoding, callback) {
  var params = this.getIndexTypeId(chunk);
  if (params) {
    this.push({ index: params });
    this.push(chunk);
  }
  callback();
};
