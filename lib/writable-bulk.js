/**
 * Expose a writeable stream and execute it as a set of bulk requests.
 */
'use strict';

var Writable = require('stream').Writable;

module.exports = WritableBulk;

/**
 * @param bulkExec closure invoked with the bulk cmds as an array and a callback
 * @param highWaterMark number of bulk commands executed at once. 128 by default.
 */
function WritableBulk(bulkExec, highWaterMark) {
  if (!(this instanceof WritableBulk)) {
    return new WritableBulk(bulkExec, highWaterMark);
  }
  Writable.call(this, {objectMode:true});
  this.bulkExec = bulkExec;

  this.highWaterMark = highWaterMark || 128;

  this.bulk = [];
  this.bulkCount = 0;
  this.expectingPayload = false;

  // when end is called we still need to flush but we must not overwrite end ourself.
  // now we need to tell everyone to listen to the close event to know when we are done.
  // Not great. See: https://github.com/joyent/node/issues/5315#issuecomment-16670354
  this.on('finish', function() {
    this._flushBulk(function() {
      this.emit('close');
    }.bind(this));
  }.bind(this));
}

WritableBulk.prototype = Object.create(Writable.prototype, {constructor: {value: WritableBulk}});

/**
 * @param chunk a piece of a bulk request as json.
 */
WritableBulk.prototype._write = function(chunk, enc, next) {
  if (this.expectingPayload) {
    this.bulkCount++;
    this.expectingPayload = false;
  } else {
    var willExpectPayload = ['index', 'create', 'update'];
    for (var i = 0; i < willExpectPayload.length; i++) {
      if (chunk.hasOwnProperty(willExpectPayload[i])) {
        this.expectingPayload = willExpectPayload[i];
        break;
      }
    }
    if (!this.expectingPayload) {
      if (!chunk.hasOwnProperty('delete')) {
        this.emit('error', new Error('Unexpected chunk, not an ' +
            'index/create/update/delete command and ' +
            'not a document to index either'));
        return next();
      }
      this.bulkCount++;
    }
  }
  this.bulk.push(chunk);
  if (this.highWaterMark <= this.bulkCount) {
    return this._flushBulk(next);
  }
  next();
};

WritableBulk.prototype._flushBulk = function(callback) {
  if (!this.bulkCount) {
    return setImmediate(callback);
  }
  var self = this;
  this.bulkExec(this.bulk, function(e, resp) {
    if (e) {
      self.emit('error', e);
    }
    if (resp.errors && resp.items) {
      for (var i = 0; i < resp.items.length; i++) {
        var bulkItemResp = resp.items[i];
        var key = Object.keys(bulkItemResp)[0];
        if (bulkItemResp[key].error) {
          self.emit('error', new Error(bulkItemResp[key].error));
        }
      }
    }
    self.bulk = [];
    self.bulkCount = 0;
    self.expectingPayload = false;
    callback();
  });
};
