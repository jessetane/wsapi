var fs = require('fs');
var http = require('http');
var ecstatic = require('ecstatic');
var browserify = require('browserify');
var wsapi = require('../');

var port = '8080';
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

var b = browserify(__dirname + '/client.js');
b.bundle(function(err, client) {
  if (err) return console.error('failed to browserify client:', err);

  fs.writeFile(__dirname + '/share/build.js', client, function(err) {
    if (err) return console.error('failed to save client:', err);

    server.listen(port, '::', function(err) {
      if (err) return console.error('failed to start http server:', err);

      console.log('server listening on ' + port);
    });
  });
});
