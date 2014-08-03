#!/usr/bin/env node

var exec = require('child_process').exec;
var port = '8080';

exec(__dirname + '/../node_modules/.bin/browserify ' + __dirname + '/client.js > ' + __dirname + '/build.js', function(err) {
  if (err) throw err;
  require('./server');
  exec('which xdg-open && xdg-open http://localhost:' + port + ' || open http://localhost:' + port);
});
