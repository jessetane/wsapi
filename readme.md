# wsapi
[ws](https://github.com/einaros/ws) + [websocket-stream](https://github.com/maxogden/websocket-stream) + [dnode](https://github.com/substack/dnode) + [mux-demux](https://github.com/dominictarr/mux-demux)

note: v1.0.0 is a first pass, has no tests and as of this writing has only been used to create the example app. use at your own risk.

## why
doing RPC over http is not so much fun. this library lets you effortlessly serve up remote APIs (over websockets) that feel local. you get auto-reconnect, heartbeat keepalive and multiplexed streaming for free. it Just Works!

## how

server.js
``` javascript
var fs = require('fs');
var http = require('http');
var wsapi = require('wsapi');
var port = '8080';

var server = http.createServer(function(req, res) {
  console.log(req.method + ' ' + req.url);

  var file = 'index.html';
  if (req.url === '/build.js') {
    res.setHeader('content-type', 'application/javascript');
    file = 'build.js';
  }
  
  res.statusCode = 200;
  res.end(fs.readFileSync(__dirname + '/' + file));
});

server.listen(port, '::', function() {
  console.log('server listening on ' + port);
  wsapi({
    server: server,
    api: require('./api'),
  });
});
```

api.js
``` javascript
var thru = require('through2').obj;

module.exports = function(muxer) {
  return {

    // simple function
    hello: function(cb) {
      cb(null, 'oh hai');
    },

    // stream
    listen: function(cb) {
      var id = Math.random();
      var stream = muxer[id] = thru();
      var number = 0;
      var interval = setInterval(function() {
        stream.write('event: ' + number++);
      }, 2000);
      stream.on('end', function() {
        clearInterval(interval);
      });
      cb(null, id);
    },

  };
};
```

client.js
``` javascript
var wsapi = require('wsapi');

var api = wsapi({
  host: 'localhost',
  port: '8080',
});

api.on('connect', function() {

  // basic function
  api.remote.hello(function(err, res) {
    console.log(res);
  });

  // stream
  api.remote.listen(function(err, id) {
    var stream = api.muxer.createStream(id);
    stream.on('data', function(data) {
      console.log(data);
    });
  });

});
```

## install
`npm install wsapi`

## example
``` bash
cd wsapi
npm install
node example
```

## require

## `var wsapi = require('wsapi')`
in a browser this returns the client constructor - in other places, the server constructor.

## server constructor
## `wsapi(opts)`
where `opts` _must_ contain:
* anything needed by [ws](https://github.com/einaros/ws/blob/master/lib/WebSocketServer.js#L20) (generally an http `server` object or a `port`)
* an `api` object to be passed to dnode - can also be a function accepting a "muxer" hash (for making named streams available to clients) as its only argument and returning an object for dnode

## client constructor
## `var api = wsapi([opts])`
where `opts` can contain:
* `protocol` string; "ws" or "wss", defaults to "ws"
* `host` string; defaults to "localhost"
* `port` string; defaults to 80
* `timeout` milliseconds; defaults to 5000
* `reconnectInterval` milliseconds; defaults to 2500
* `heartbeatInterval` milliseconds; defaults to 50000 (50 seconds)

## client events
* `connect`
* `disconnect`

## license
WTFPL
