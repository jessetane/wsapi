# wsapi
[ws](https://github.com/einaros/ws) + [websocket-stream](https://github.com/maxogden/websocket-stream) + [multiplex](https://github.com/maxogden/multiplex) + [dnode](https://github.com/substack/dnode)

[![npm](http://img.shields.io/npm/v/wsapi.svg?style=flat-square)](http://www.npmjs.org/wsapi)
[![tests](https://img.shields.io/travis/jessetane/wsapi.svg?style=flat-square&branch=master)](https://travis-ci.org/jessetane/wsapi)
[![coverage](https://img.shields.io/coveralls/jessetane/wsapi.svg?style=flat-square&branch=master)](https://coveralls.io/r/jessetane/wsapi)

## Why
Doing RPC and file uploads / downloads over http is not so much fun. This library lets you effortlessly serve up APIs (over websockets) that feel local. You get auto-reconnect, heartbeat keepalive and multiplexed binary streaming for free. It Just Works!

## How
server.js
``` javascript
var http = require('http');
var ecstatic = require('ecstatic');
var wsapi = require('wsapi');

var statics = ecstatic(__dirname + '/share', { cache: 'no-cache' });

var server = http.createServer(function(req, res) {
  console.log(req.url);
  statics(req, res, function() {
    req.url = '/';
    statics(req, res);
  });
});

wsapi({
  server: server,
  methods: require('./api'),
});

server.listen('8080', '::', function(err) {
  console.log('server listening on ' + port);
});
```

api.js
``` javascript
module.exports = function(muxer) {
  return {

    // simple function
    hello: function(cb) {
      cb(null, 'oh hai');
    },

    // stream
    startListening: function(cb) {
      var number = 0;
      var stream = muxer.createStream();
      var interval = setInterval(function() {
        stream.write('event: ' + number++);
      }, 2000);
      stream.on('finish', function() {
        clearInterval(interval);
      });
      cb(null, stream.meta);
    },

  };
};
```

client.js
``` javascript
var wsapi = require('wsapi');
var api = wsapi();

api.on('connect', function() {

  // basic function
  api.methods.hello(function(err, res) {
    console.log(res);
  });

  // stream
  api.methods.startListening(function(err, id) {
    api.on('stream', function(stream) {
      if (stream.meta === id) {
        stream.on('data', function(data) {
          console.log(data.toString());
        });
      }
    });
  });

});
```

## Install
`npm install wsapi`

## Test
`node test`

## Example
``` bash
cd wsapi
npm install
node example
```

## Require
#### `var wsapi = require('wsapi')`
In a browser this returns the client constructor - in other places, the server constructor.

## Server constructor
#### `var server = wsapi(opts)`
Where `opts` _must_ contain:
* Anything needed by [ws](https://github.com/einaros/ws/blob/master/lib/WebSocketServer.js#L20) (generally an http `server` object or a `port`)
* A `methods` object to be passed to dnode, or a function (that accepts a multiplex instance as an argument) which returns a `methods` object

## Server instance methods
#### `server.close()`
Close the server and disconnect all clients.

## Client constructor
#### `var api = wsapi([opts])`
Where `opts` can contain:
* `protocol` string; "ws" or "wss", defaults to "ws"
* `host` string; defaults to "localhost"
* `port` string; defaults to 80
* `timeout` milliseconds; defaults to 5000
* `reconnectInterval` milliseconds; defaults to 2500
* `heartbeatInterval` milliseconds; defaults to 50000 (50 seconds)

## Client instance methods
#### `api.connect()`
Generally you shouldn't need to call this directly since it is invoked automatically by the constructor and auto-reconnect logic.
#### `api.disconnect()`
Disconnect from the server if connected.
#### `api.createStream([id])`
Open a binary duplex stream to the server - if `id` is omitted, a random one will be generated.

## Client instance properties
#### `api.methods`
An object, your api methods will be available on this object after connecting.
#### `api.connecting`
Boolean.
#### `api.connected`
Boolean.

## Client events
#### `api.emit('connect')`
Emitted when a client successfully connects to a server.
#### `api.emit('disconnect')`
Emitted when the connection to a server is lost.
#### `api.emit('stream', stream)`
Emitted when a new stream has been opened by the server.
#### `api.emit('error', err)`
Generally emitted when connection attempts fail and when a method call times out.

## Releases
The latest stable release is published to [npm](http://npmjs.org/wsapi).
* [2.1.0](https://github.com/jessetane/wsapi/archive/2.1.0.tar.gz)
 * Disconnect client on error.
* [2.0.0](https://github.com/jessetane/wsapi/archive/2.0.0.tar.gz)
 * Rewrite to support binary streaming by switching from [mux-demux](https://github.com/dominictarr/mux-demux) to [multiplex](https://github.com/maxogden/multiplex).
* [1.x](https://github.com/jessetane/wsapi/archive/1.0.0.tar.gz)
 * First pass.

## License
Copyright © 2014 Jesse Tane <jesse.tane@gmail.com>

This work is free. You can redistribute it and/or modify it under the
terms of the [WTFPL](http://www.wtfpl.net/txt/copying).

No Warranty. The Software is provided "as is" without warranty of any kind, either express or implied, including without limitation any implied warranties of condition, uninterrupted use, merchantability, fitness for a particular purpose, or non-infringement.