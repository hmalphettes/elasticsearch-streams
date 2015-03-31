# Elasticsearch streams

Expose a Writeable stream for bulk commands and a Readable stream from
hits and documents responses.

Use case: pipe to and from levelup, pouchdb and other friends.

The client that executes the requests is wrapped in a closure.
It is expected to provide the Elasticsearch reponse's body as a JSON.

See the examples and tests with the official Elasticsearch-js client.

# Examples:

## Stream random records into Elasticsearch
```
var WritableBulk = require('elasticsearch-streams').WritableBulk;
var client = new require('elasticsearch').Client();

var bulkExec = function(bulkCmds, callback) {
  client.bulk({
    index : 'myindex',
    type  : 'mytype',
    body  : bulkCmds
  }, callback);
};
var ws = new WritableBulk(bulkExec);
var toBulk = new TransformToBulk(function getIndexTypeId(doc) { return { _id: doc.id }; });
// stream 42 random records into ES
require('random-document-stream')(42).pipe(toBulk).pipe(ws).on('finish', done);
```

NOTE: One must listen to the `close` event emitted by the write stream to know
when all the data has been written and flushed to Elasticsearch.

Listening to `finish` does not mean much really as we are in this situation:
https://github.com/joyent/node/issues/5315#issuecomment-16670354

For example to close the ES client as soon as we are done:

```
ws.on('close', function () {
  client.close();
});
```

## Stream search results from Elasticsearch
```
var ReadableSearch = require('elasticsearch-streams').ReadableSearch;
var client = new require('elasticsearch').Client();

var searchExec = function searchExec(from, callback) {
  client.search({
    index: 'myindex',
    from: from,
    size: 12,
    body: {
      query: { match_all: {} }
    }
  }, callback);
};

var rs = new ReadableSearch(searchExec);
var ws = new require('stream').Writable({objectMode:true});
ws._write = function(chunk, enc, next) {
  console.log('a hit', hit);
  next();
};

rs.pipe(ws).on('close', done);
```

If we want to start the stream at an offset and define a limit:

```
var offset = 7;
var limit  = 21;
var page   = 12;

var searchExec = function searchExec(from, callback) {
  client.search({
    index: 'myindex',
    from: from + offset,
    size: (offset + from + page) > limit ? (limit - offset - from) : page,
    body: {
      query: { match_all: {} }
    }
  }, callback);
};
```

## Stream scroll/scan results from Elasticsearch
```
var scrollExec = function scrollExec(from, callback) {
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
    size: 42,
    body: {
      query: { match_all: {} }
    }
  }, function(e, resp) {
    self.scroll_id = resp._scroll_id;
    callback(e, resp);
  });
};
rs = new ReadableSearch(scrollExec);
```

## Stream IDs into Elasticsearch multi-get and get documents out.
```
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

// Naive read stream of 12 ids that are numbers
var rs = new require('stream').Readable({objectMode: true});
rs._read = function() {
  for (var i = 0; i < 12; i++) {
    rs.push(i);
  }
  rs.push(null);
};

var ws = new require('stream').Writable({objectMode:true});
ws._write = function(chunk, enc, next) {
  console.log(hit._id + ' found: ' + hit._found, hit);
  next();
};

rs.pipe(ts).pipe(ws).on('finish', onFinish);
```

# LICENSE
elasticsearch-streams is freely distributable under the terms of the MIT license.

Copyright (c) 2015 Sutoiku, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
