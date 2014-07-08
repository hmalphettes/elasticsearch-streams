/**
 * Stream document IDs and transform them into Documents.
 */
'use strict';
var Transform = require('stream').Transform;

module.exports = PipableDocs;

/**
 * @param mgetExec an executable query functions that takes 2 arguments:
 *       a list of document IDs and a callback.
 * @param corkSize number of documents fetched at once. 128 by default.
 */
function PipableDocs(mgetExec, corkSize) {
  if (!(this instanceof PipableDocs)) {
    return new PipableDocs(mgetExec);
  }
  Transform.call(this, {objectMode:true});
  this.mgetExec = mgetExec;
  this.corkSize = corkSize;

// current mget
  this._docIds = [];
}

PipableDocs.prototype = Object.create(Transform.prototype, {constructor: {value: PipableDocs}});

PipableDocs.prototype._transform = function(chunk, encoding, callback) {
  this._docIds.push(chunk);
  if (this._docIds.length < this.corkSize) {
    return callback();
  }
  this._flush(callback);
};

PipableDocs.prototype._flush = function(callback) {
  if (!this._docIds.length) {
    return callback();
  }
  var docIds = this._docIds;
  this._docIds = [];
  var self = this;
  this.mgetExec(docIds, function(e, resp) {
    if (e) {
      self.emit('error', e);
      return callback();
    }
    for (var i = 0; i < resp.docs.length; i++) {
      self.push(resp.docs[i]);
    }
    callback();
  });
};
