'use strict';
var expect = require('chai').expect;
var ReadableSearch = require('..').ReadableSearch;
var PipableDocs = require('..').PipableDocs;
var Writable = require('stream').Writable;
var Readable = require('stream').Readable;
var client = new require('elasticsearch').Client({log: 'warning'});
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
    checkRecords(rs, null, 42, done);
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
    checkRecords(rs, null, 42, done);
  });
});

describe('When getting documents by id', function() {
  var ids;
  var ts;
  before(function(done) {
    ids = populateIndex(42, function(e) {
      if (e) { return done(e); }
      expect(ids.length).to.equal(42);
      var mgetExec = function(docs, callback) {
        client.mget({
          index: 'myindex',
          type: 'mytype',
          body: {
            docs: { ids: docs }
          }
        }, callback);
      };
      ts = new PipableDocs(mgetExec, 4);
      done();
    });
  });
  it('Must pipe', function(done) {
    var i = -1;
    var rs = new Readable({objectMode: true});
    rs._read = function() {
      i++;
      if (i >= ids.length) {
        return rs.push(null);
      }
      rs.push(ids[i]);
    };
    checkRecords(rs, ts, 42, done);
  });
});

function populateIndex(nb, done) {
  var ids = [];
  client.indices.delete({index:'myindex'}, function() {
    var cmds = [];
    var generator = random(0);
    for (var i = 0; i < nb; i++) {
      var rec = generator.makeJunk();
      cmds.push({ index:  { _index: 'myindex', _type: 'mytype', _id: rec._id } });
      cmds.push(rec);
      ids.push(rec._id);
    }
    client.bulk({
      body: cmds
    }, function(e) {
      if (e) { return done(e); }
      client.indices.refresh({index: 'myindex'}, done);
    });
  });
  return ids;
}

function checkRecords(rs, ts, nb, done) {
  var hits = [];
  var err;
  var ws = new Writable({objectMode:true});
  ws._write = function(chunk, enc, next) {
    hits.push(chunk);
    expect(chunk._index).to.equal('myindex');
    expect(chunk._type).to.equal('mytype');
    expect(chunk._id).to.exist;
    expect(chunk._source.name).to.exist;
    next();
  };
  var errClosure = function(e) {
    err = e;
  };
  rs.on('error', errClosure);
  ws.on('error', errClosure);
  if (ts) {
    ts.on('error', errClosure);
  }
  function onFinish() {
    if (err) { return done(err); }
    expect(hits.length).to.equal(nb);
    done();
  }
  if (ts) {
    rs.pipe(ts).pipe(ws).on('finish', onFinish);
  } else {
    rs.pipe(ws).on('finish', onFinish);
  }
}