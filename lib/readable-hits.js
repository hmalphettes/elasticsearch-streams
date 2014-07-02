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
 * @param queryExec an executable query functions that takes 2 arguments: the query and its callback.
 * @param pushKeysFirst true to stream the name of the properties first and values second
 *        by default false
 */
function ReadableHits(queryExec, query, limit, emitSourceOnly) {
  Readable.call(this, {objectMode:true});
  this.queryExec = queryExec;
  this.query = query;
  this.pageSize = query.size || 256;
  this.emitSourceOnly = !!emitSourceOnly;
  this.total = -1;
  this.from = query.form || 0;
  this._next = true;
  if (limit > 0) {
    this.limit = limit;
  }

// current iteration through the page
  this._hits = [];
  this._current = 0;
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
  this.from += this.pageSize;
  var self = this;
  this.queryExec(this.query, function(e, resp) {
    self._current = 0;
    self._hits = resp.hits ? resp.hits.hits : resp.docs.docs;
    if (self.from + self.pageSize > self._hits.length) {
      self._next = false;
    }
    self._shift();
  });
};

ReadableHits.prototype._shift = function() {//size) {
  this.push(this._hits[this._current]);
};
