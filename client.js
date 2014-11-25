var websocket = require('websocket-stream');
var dnode = require('dnode');
var Muxer = require('multiplex');
var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var thru = require('through2').obj;

var clients = {};
var debug = false;

module.exports = function(opts) {

  // defaults
  opts = opts || {};
  opts.protocol = opts.protocol || 'ws';
  opts.host = opts.host || window.location.hostname;
  opts.port = opts.port || window.location.port;

  // there should only ever be one client per protocol/host/port 
  // except in special circumstances like testing
  if (!opts.nocache) {
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
  }
  else {
    client = new Client(opts);
  }

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

  this.ondisconnect = ondisconnect.bind(this);
  this.onerror = onerror.bind(this);
  this.name = Math.random();
  this.session = Math.random();

  // do this in nextTick so callers have a chance to add event listeners
  var self = this;
  var session = this.session;
  setTimeout(function() {
    if (self.session === session) self.connect();
  });
}
inherits(Client, EventEmitter);

Client.prototype.connect = function() {
  if (this.connecting || this.connected) return;
  if (debug) console.warn('connecting');
  this.connecting = true;

  this.ws = websocket(this.protocol + '://' + this.host + ':' + this.port);
  this.ws.on('close', this.ondisconnect);
  this.ws.on('error', this.onerror);

  var self = this;
  this.muxer = new Muxer(function(stream) {
    self.emit('stream', stream);
  });
  this.ws.pipe(this.muxer).pipe(this.ws);

  var rpcstream = this.muxer.createStream('__dnode__');
  var rpcclient = dnode();
  rpcclient.on('remote', onconnect.bind(this));
  rpcstream.pipe(thru(function(c, enc, cb) {
    cb(null, c.toString());
  })).pipe(rpcclient).pipe(rpcstream);
};

Client.prototype.disconnect = function() {
  if (this.reconnectIntervalId) clearInterval(this.reconnectIntervalId);
  this.ondisconnect();
};

Client.prototype.createStream = function(id) {
  if (!this.connected) throw new Error('not connected');
  if (!id) id = (Math.random() * 100000000).toFixed();
  return this.muxer.createStream(id);
};

function onconnect(remote) {
  if (debug) console.warn('connected');

  this.methods = wrap.call(this, remote, {});
  this.connecting = false;
  this.connected = true;
  this.lastActivity = +new Date;
  this.emit('connect');

  if (this.reconnectIntervalId) return;

  var self = this;
  this.reconnectIntervalId = setInterval(function() {
    var timeSinceLastActivity = +new Date - self.lastActivity;
    if (!self.connected) {
      if (!self.connecting) {
        self.connect();
      }
    }
    else if (timeSinceLastActivity > self.heartbeatInterval) {
      if (debug) console.warn('ping');
      self.lastActivity = +new Date;
      self.methods.ping(function(err) {
        if (err) return self.ondisconnect();
        self.latency = +new Date - self.lastActivity;
      });
    }
  }, this.reconnectInterval);
}

function ondisconnect() {
  if (debug) console.warn('disconnected');

  if (this.muxer) {
    this.muxer.end();
    delete this.muxer;
  }

  if (this.ws) {
    this.ws.removeListener('close', this.ondisconnect);
    this.ws.removeListener('error', this.onerror);
    this.ws.end();
    delete this.ws;
  }

  this.session = Math.random();
  this.connecting = false;
  if (this.connected) {
    this.connected = false;
    this.emit('disconnect');
  }
}

function onerror(err) {
  if (this.listeners('error').length) {
    this.emit('error', err);
  }
  this.ondisconnect();
}

function wrap(src, dest) {
  var self = this;
  for (var key in src) (function(method) {
    if (typeof method === 'function') {
      dest[key] = methodWrapper;
      function methodWrapper() {
        var args = [].slice.call(arguments);
        var cb = args.slice(-1)[0];
        if (cb && typeof cb === 'function') {

          // timeout
          var timeoutId = setTimeout(function() {
            var err = new Error('operation timed out');
            err.code = 408;
            timeoutId = null;
            cb(err);
            onerror.call(self, err);
          }, self.timeout);

          // replace cb with a wrapper that cancels the timeout
          args.splice(-1, 1, function() {
            if (timeoutId !== null) {
              clearTimeout(timeoutId);
              self.lastActivity = +new Date;
              cb.apply(null, arguments);
            }
          });
        }
        self.lastActivity = +new Date;
        method.apply(null, args);
      }
    }
    else {
      wrap.call(self, method, dest[key] = {});
    }
  })(src[key]);
  return dest;
}
