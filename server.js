var dnode = require('dnode');
var WebSocketServer = require('ws').Server;
var websocket = require('websocket-stream');
var Muxer = require('multiplex');

var debug = false;

module.exports = function(opts) {
  var methodsproto = opts.methods;
  delete opts.methods;
  var wss = new WebSocketServer(opts);
  wss.on('connection', function(ws) {
    var muxer = new Muxer(function(stream, id) {

      if (debug) console.warn('stream requested: ' + id);

      // rpc server stream
      if (id === '__dnode__') {
        stream.pipe(dnode(methods)).pipe(stream);
      }
      
      // arbitrary streams
      else {
        muxer.emit('stream', stream);
      }
    });
    
    // override muxer.createStream to autogen random stream ids
    // this is not really safe, but it's better than the default 
    // behavior which is even more prone to collisions..
    var cs = muxer.createStream;
    muxer.createStream = function(id) {
      if (!id) id = (Math.random() * 100000000).toFixed();
      return cs(id);
    };

    var methods = typeof methodsproto === 'function' ? methodsproto(muxer) : methodsproto;

    // the client requires a ping method for implementing heartbeat keepalive
    methods.ping = methods.ping || function(cb) {
      cb();
    };

    var wsstream = websocket(ws);
    wsstream.pipe(muxer).pipe(wsstream);
    wsstream.on('close', function() {
      muxer.end();
    });

    if (debug) console.warn('websocket opened');
  });

  return wss;
};
