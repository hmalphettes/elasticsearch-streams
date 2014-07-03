'use strict';
var expect = require('chai').expect;
var ReadableSearch = require('..').ReadableSearch;
var Writable = require('stream').Writable;
var client = new require('elasticsearch').Client();
var random = require('random-document-stream');

describe('When searching', function() {
  var rs;
  before(function(done) {
    populateIndex(42, function(e) {
      if (e) { return done(e); }
      var queryExec = function(from, callback) {
        client.search({
          index: 'myindex',
          from: from,
          size: 2,
          body: {
            query: { match_all: {} }
          }
        }, callback);
      };
      rs = new ReadableSearch(queryExec);
      done();
    });
  });
  it('Must find 42 records by searching them', function(done) {
    checkRecords(rs, 42, done);
  });
});

describe('When scrolling', function() {
  var rs;
  before(function(done) {
    populateIndex(42, function(e) {
      if (e) { return done(e); }
      var queryExec = function queryExec(from, callback) {
        if (this.scroll_id) {
          return client.scroll({
            scrollId : this.scroll_id,
            scroll   : '30s'
          }, callback);
        }
        // get a scroll id first
        var self = this;
        client.search({
          index: 'myindex',
          scroll: '20s',
          size: '3',
          body: {
            query: { match_all: {} }
          }
        }, function(e, resp) {
          self.scroll_id = resp._scroll_id;
          callback(e, resp);
        });
      };
      rs = new ReadableSearch(queryExec);
      done();
    });
  });
  it('Must find the 42 records by scroll', function(done) {
    checkRecords(rs, 42, done);
  });
});

function populateIndex(nb, done) {
  client.indices.delete({index:'myindex'}, function() {
    var cmds = [];
    var generator = random(0);
    for (var i = 0; i < nb; i++) {
      var rec = generator.makeJunk();
      cmds.push({ index:  { _index: 'myindex', _type: 'mytype', _id: rec._id } });
      cmds.push(rec);
    }
    client.bulk({
      body: cmds
    }, function(e) {
      if (e) { return done(e); }
      client.indices.refresh({index: 'myindex'}, done);
    });
  });
}

function checkRecords(rs, nb, done) {
  var hits = [];
  var err;
  var ws = new Writable({objectMode:true});
  ws._write = function(chunk, enc, next) {
    hits.push(chunk);
    expect(chunk._index).to.equal('myindex');
    expect(chunk._type).to.equal('mytype');
    expect(chunk._score).to.equal(1);
    expect(chunk._id).to.exist;
    expect(chunk._source.name).to.exist;
    next();
  };
  rs.on('error', function(e) {
    err = e;
  });
  rs.on('end', function() {
    if (err) { return done(err); }
    expect(hits.length).to.equal(nb);
    done();
  });
  rs.pipe(ws);
}