/**
 * Expose an elasticsearch query that returns hits or docs as a stream of hits or docs.
 *
 * Expect the query to be a JSON object where the from property defines the offset
 * and the limit defines the page size.
 * Expect the client to return a parsed JSON.
 */
'use strict';
var Readable = require('stream').Readable;

module.exports = ReadableHits;

/**
 * @param queryExec an executable query functions that takes 2 arguments: the offset and a callback.
 */
function ReadableHits(queryExec, parseHit) {
  if (!(this instanceof ReadableHits)) {
    return new ReadableHits(queryExec);
  }
  Readable.call(this, {objectMode:true});
  this.queryExec = queryExec;
  this.total = -1;
  this.from = 0;
  this._next = true;

// current iteration through the page
  this._hits = [];
  this._current = 0;
  this.parseHit = parseHit || identity;
}

ReadableHits.prototype = Object.create(Readable.prototype, {constructor: {value: ReadableHits}});

ReadableHits.prototype._read = function() {//size) {
  this._current++;
  if (this._current >= this._hits.length) {
    if (!this._next) {
      return this.push(null);
    }
    this._fetchNextPage();
  } else {
    this._shift();
  }
};

ReadableHits.prototype._fetchNextPage = function() {//size) {
  var self = this;
  this.queryExec(this.from, function(e, resp) {
    self._current = 0;
    if (e) {
      self.hits = [];
      self._next = false;
      self.emit('error', e);
      return self.push(null);
    }
    self.total = resp.hits.total;
    self._hits = resp.hits.hits;
    self.from += self._hits.length;
    if (self.from >= self.total) {
      self._next = false; // we got them all.
    }
    if (!self._hits.length) {
      // nothing here: end the stream.
      // self._next = false; // precaution but we should not really need this line.
      return self.push(null);
    }
    self._shift();
  });
};

ReadableHits.prototype._shift = function() {
  this.push(this.parseHit(this._hits[this._current]));
};

ReadableHits.prototype.destroy = function() {
  if (this.destroyed) {
    return;
  }
  this.destroyed = true;
  this._next = false;
  this.unpipe();
};


function identity(hit) {
  return hit;
}
