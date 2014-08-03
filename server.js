var dnode = require('dnode');
var WebSocketServer = require('ws').Server;
var websocket = require('websocket-stream');
var Demuxer = require('mux-demux');

var debug = false;

module.exports = function(opts) {
  var apiPrototype = opts.api;
  delete opts.api;
  var wss = new WebSocketServer(opts);
  wss.on('connection', function(ws) {
    var muxer = {};
    var api = typeof apiPrototype === 'function' ? apiPrototype(muxer) : apiPrototype;

    // the client requires that the api include a ping method
    api.ping = function(message, cb) {
      if (typeof cb === 'function') {
        cb(null, message);
      }
    };

    var demuxer = new Demuxer(function(stream) {
      var id = stream.meta;

      if (debug) console.warn('stream requested: ' + id);

      // api
      if (id === '__dnode__') {
        stream.pipe(dnode(api, { weak: false })).pipe(stream);
      }
      
      // arbitrary streams
      else if (id) {
        var src = null;

        // an api method has already set up this stream
        if (muxer[id]) {
          src = muxer[id];
        }

        // only set up if we have a src
        if (src) {

          // forward errors from the client back to the source
          stream.on('error', function(err) {
            src.emit('error', err);
          });

          // forward errors from the source back to the client
          src.on('error', function(err) {
            stream.error(err.message);
          });

          // clean up ended streams
          src.on('end', function() {
            delete muxer[id];
          });
          
          // hook up streams
          if (src.readable && stream.writable) src.pipe(stream);
          if (src.writable && stream.readable) stream.pipe(src);
        }
      }
    });
    
    var con = websocket(ws);
    con.pipe(demuxer).pipe(con);
    con.on('error', function(err) {

      if (debug) console.warn('websocket closed');

      for (var s in muxer) {
        if (muxer[s].emit) {
          muxer[s].end();
        }
      }
    });

    if (debug) console.warn('websocket opened');
  });

  return wss;
};
