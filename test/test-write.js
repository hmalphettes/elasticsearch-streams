'use strict';
var expect = require('chai').expect;
var WritableBulk = require('..').WritableBulk;
var TransformToBulk = require('..').TransformToBulk;
var random = require('random-document-stream');
var client = new require('elasticsearch').Client({log: 'warning'});

describe('When writing', function() {
  var ws;
  before(function(done) {
    var bulkExec = function(bulkCmds, callback) {
      client.bulk({
        index : 'myindex2',
        type  : 'mytype',
        body  : bulkCmds
      }, callback);
    };

    var err;

    ws = new WritableBulk(bulkExec);
    ws.on('error', function(e) {
      err = e;
    }).on('close', function() {
      done(err);
    });

    var transformToBulk = new TransformToBulk(function(doc) {
      return { _id: doc._id };
    });
    // drop the index then
    client.indices.delete({index: 'myindex2'}, function() {
      // stream 42 random docs into ES
      random(42).pipe(transformToBulk).pipe(ws);
    });
  });
  it('Must have indexed 42 docs', function(done) {
    client.indices.refresh({ index: 'myindex2' }, function() {
      client.count({
        index: 'myindex2',
        type: 'mytype'
      }, function(e, res) {
        if (e) { return done(e); }
        expect(res.count).to.equal(42);
        done();
      });
    });
  });
});
