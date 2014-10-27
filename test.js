var tape = require('tape');
var Server = require('./server');
var Client = require('./client');
var concat = require('concat-stream');
var fs = require('fs');

var readme = fs.readFileSync(__dirname + '/readme.md', 'utf8');

function mkapi(muxer) {
  return {

    uppercase: function(msg, cb) {
      cb(null, msg.toUpperCase());
    },

    download: function(cb) {
      var file = fs.createReadStream(__dirname + '/readme.md');
      var download = muxer.createStream();
      file.pipe(download);
      cb(null, download.meta);
    },

    upload: function(id, cb) {
      muxer.on('stream', function(upload) {
        if (upload.meta === id) {
          var file = fs.createWriteStream('/tmp/wsapi-test-upload');
          file.on('finish', function() {
            fs.createReadStream('/tmp/wsapi-test-upload').pipe(concat(function(buf) {
              cb(null, buf.toString() === readme);
            }));
          });
          upload.pipe(file);
        }
      });
    },

    timeout: function(cb) {
      // never call cb
    },

    nested: {
      stuff: {
        here: function(cb) { cb(); }
      }
    }

  };
}

var PORT = 8888;

var server = Server({
  port: PORT,
  methods: mkapi,
});

tape('test client caching', function(t) {
  t.plan(2);
  
  var client = Client({ host: '::', port: PORT });
  var client1 = Client({ host: '::', port: PORT });
  var client2 = Client({ protocol: 'ws', host: '::', port: PORT });
  
  client.disconnect();

  t.equals(client1, client);
  t.equals(client2, client);
});

tape('simple method call', function(t) {
  t.plan(2);
  
  var client = Client({ host: '::', port: PORT, nocache: true });

  client.on('connect', function() {
    client.methods.uppercase('yo', function(err, res) {
      t.error(err);
      t.equal(res, 'YO', 'simple method call successful');
      client.disconnect();
    });
  });
});

tape('method call timeout', function(t) {
  t.plan(3);

  var client = Client({ host: '::', port: PORT, nocache: true, timeout: 100 });

  client.on('connect', function() {
    var start = +new Date;
    client.methods.timeout(function(err, res) {
      t.equal(err.code, 408, 'method call did timeout');
      var end = +new Date;
      var duration = end - start;
      t.ok(Math.abs(duration - client.timeout) <= 10, 'timeout duration was respected');
    });
  });

  client.on('error', function(err) {
    t.ok(err, 'client did emit timeout error');
    client.disconnect();
  });
});

tape('test download', function(t) {
  t.plan(2);

  var client = Client({ host: '::', port: PORT, nocache: true });

  client.on('connect', function() {
    client.methods.download(function(err, id) {
      t.error(err);
      client.on('stream', function(stream) {
        if (stream.meta === id) {
          stream.pipe(concat(function(buf) {
            t.equal(buf.toString(), readme, 'download contents match original');
            client.disconnect();
          }));
        }
      })
    });
  });
});

tape('test upload', function(t) {
  t.plan(2);

  var client = Client({ host: '::', port: PORT, nocache: true });

  client.on('connect', function() {
    var upload = client.createStream();
    client.methods.upload(upload.meta, function(err, passed) {
      t.error(err);
      t.ok(passed, 'upload contents match original');
      client.disconnect();
    });
    var min = 5;
    var max = 100;
    var numchunks = Math.floor(Math.random() * (max - min + 1)) + min;
    var chunksize = Math.floor(readme.length / numchunks);
    for (var i=0; i<numchunks; i++) {
      var chunk = readme.slice(chunksize * i, chunksize * i + chunksize);
      upload.write(chunk);
    }
    upload.end(readme.slice(chunksize * i, readme.length));
  });
});

tape('auto-reconnect', function(t) {
  t.plan(4);

  var start = 0;
  var reconnecting = false;
  var client = Client({ host: '::', port: PORT, nocache: true, reconnectInterval: 100 });

  client.on('connect', function() {
    if (reconnecting) {
      var end = +new Date;
      var duration = end - start;
      t.ok(Math.abs(duration - client.reconnectInterval) <= 10, 'reconnect interval was respected');
      t.ok(1, 'client saw reconnect');
      client.disconnect();
      server.close();
      return;
    }

    client.methods.uppercase('yo', function(err, res) {
      t.error(err);
      server.close();
    });
  });

  client.once('disconnect', function() {
    t.ok(1, 'client saw disconnect');
    start = +new Date;
    reconnecting = true;
    server = Server({ port: PORT, methods: mkapi });
  });
});

tape('heartbeat keepalive', function(t) {
  t.plan(1);

  server = Server({ port: PORT, methods: {
    activity: function(cb) {
      cb();
    },
    ping: function(cb) {
      var end = +new Date;
      var duration = end - start;
      var timeSinceLastActivity = Math.abs(duration - client.heartbeatInterval * 3);
      t.ok(timeSinceLastActivity <= 30, 'heartbeatInterval was respected');
      cb();
      server.close();
    }
  }});

  var start = 0;
  var client = Client({ host: '::', port: PORT, nocache: true, reconnectInterval: 50, heartbeatInterval: 100 });

  client.on('connect', function() {
    start = +new Date;
    setTimeout(function() {
      client.methods.activity(function() {});
    }, 90)
    setTimeout(function() {
      client.methods.activity(function() {});
    }, 190)
  });

  client.on('disconnect', function() {
    client.disconnect();
  });
});
