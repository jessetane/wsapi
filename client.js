var websocket = require('websocket-stream');
var dnode = require('dnode');
var Muxer = require('mux-demux');
var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');

var clients = {};
var debug = false;

// module is actually a singleton factory
module.exports = function(opts) {

  // defaults
  opts = opts || {};
  opts.protocol = opts.protocol || 'ws';
  opts.host = opts.host || window.location.hostname;
  opts.port = opts.port || window.location.port;

  if (clients[opts.protocol] && 
      clients[opts.protocol][opts.host] && 
      clients[opts.protocol][opts.host][opts.port]) {
    client = clients[opts.protocol][opts.host][opts.port];
  }
  else {
    clients[opts.protocol] = clients[opts.protocol] || {};
    clients[opts.protocol][opts.host] = clients[opts.protocol][opts.host] || {};
    client = new Client(opts);
  }
  clients[opts.protocol][opts.host][opts.port] = client;
  return client;
};

function Client(opts) {
  EventEmitter.call(this);
  this.setMaxListeners(9999);

  this.protocol = opts.protocol;
  this.host = opts.host;
  this.port = opts.port;
  this.timeout = opts.timeout || 5000;
  this.reconnectInterval = opts.reconnectInterval || 2500;
  this.heartbeatInterval = opts.heartbeatInterval || 50000;
  this.connected = false;

  // do this in nextTick so callers have a chance to add event listeners
  setTimeout(connect.bind(this));
}
inherits(Client, EventEmitter);

Client.prototype.disconnect = function() {
  // TODO I guess.. but really, do we need this?
};

function connect() {
  if (this.connecting || this.connected) return;
  if (debug) console.warn('connecting');
  this.connecting = true;

  this.ws = websocket(this.protocol + '://' + this.host + ':' + this.port);
  this.dnode = dnode();
  this.muxer = new Muxer;
  this.rpc = this.muxer.createStream('__dnode__');

  this.ws.on('error', onerror.bind(this));
  this.dnode.on('remote', onremote.bind(this));

  this.ws.pipe(this.muxer).pipe(this.ws);
  this.rpc.pipe(this.dnode).pipe(this.rpc);
}

function onremote(remote) {
  if (debug) console.warn('connected');

  this.remote = wrap.call(this, remote, {});
  this.connecting = false;
  this.connected = true;
  this.activity = 0;
  this.emit('connect');

  if (this.reconnectIntervalId) return;

  var self = this;
  this.reconnectIntervalId = setInterval(function() {
    var timeSinceLastActivity = +new Date - self.activity;
    if (!self.connected) {
      if (!self.connecting) {
        connect.call(self);
      }
    }
    else if (timeSinceLastActivity > self.heartbeatInterval) {
      if (debug) console.warn('ping');
      self.activity = +new Date;
      self.remote.ping(self.activity, function(err, message) {
        self.latency = +new Date - message;
      });
    }
  }, this.reconnectInterval);
}

function onerror(err) {
  var ws = this.ws;

  if (debug) console.warn('disconnected');

  if (ws) {
    ws.end();
    setTimeout(function() {
      ws.removeAllListeners();
    });
    delete this.ws;
  }

  this.connecting = false;
  this.connected = false;

  if (!(err instanceof Error)) {
    err = new Error('network error');
  }
  err.code = 503;
  this.emit('disconnect', err);
}

function wrap(src, dest) {
  var self = this;
  for (var key in src) (function(method) {
    if (typeof method === 'function') {
      dest[key] = function() {
        var args = [].slice.call(arguments);
        var cb = args.slice(-1)[0];
        if (cb) {

          // not connected
          if (!self.connected) {
            return cb(new Error('not connected'));
          }

          // timeout
          var timeoutId = setTimeout(function() {
            var err = new Error('operation timed out');
            err.code = 503;
            timeoutId = null;
            cb(err);
            onerror.call(self);
          }, self.timeout);

          // replace cb with a wrapper that cancels the timeout
          args.splice(-1, 1, function() {
            if (timeoutId !== null) {
              clearTimeout(timeoutId);
              self.activity = +new Date;
              cb.apply(null, arguments);
            }
          });
        }
        self.activity = +new Date;
        method.apply(null, args);
      }
    }
    else {
      wrap.call(self, method, dest[key] = {});
    }
  })(src[key]);
  return dest;
}
