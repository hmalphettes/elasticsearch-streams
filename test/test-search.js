'use strict';
var expect = require('chai').expect;
var ReadableHits = require('../lib/readable-hits');
var Writable = require('stream').Writable;
var client = new require('elasticsearch').Client();

describe('When searching', function() {
  var rs;
  before(function(done) {
    client.bulk({
      body: [
        { index:  { _index: 'myindex', _type: 'mytype', _id: 1 } },
        { title: 'foo' },
        { index: { _index: 'myindex', _type: 'mytype', _id: 2 } },
        { title: 'bar' },
        { index: { _index: 'myindex', _type: 'mytype', _id: 3 } },
        { title: 'joe' }
      ]
    }, function(e) {
      if (e) { return done(e); }
      var params = {
        index: 'myindex',
        from: 0,
        size: 12,
        body: {
          query: { match_all: {} }
        }
      };
      var queryExec = function(params, callback) {
        client.search(params, callback);
      };
      rs = new ReadableHits(queryExec, params);
      done();
    });
  });
  it('Must find 3 records', function(done) {
    var hits = [];
    var err;
    var ws = new Writable({objectMode:true});
    ws._write = function(chunk, enc, next) {
      hits.push(chunk);
      expect(chunk._index).to.equal('myindex');
      expect(chunk._type).to.equal('mytype');
      expect(chunk._score).to.equal(1);
      expect(chunk._id).to.exist;
      expect(chunk._source.title).to.exist;
      next();
    };
    rs.on('error', function(e) {
      err = e;
    });
    rs.on('end', function() {
      if (err) { return done(err); }
      expect(hits.length).to.equal(3);
      done();
    });
    rs.pipe(ws);
  });
});