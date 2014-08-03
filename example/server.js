var fs = require('fs');
var http = require('http');
var wsapi = require('../');
var port = '8080';

var server = http.createServer(function(req, res) {
  console.log(req.method + ' ' + req.url);

  var file = 'index.html';
  if (req.url === '/build.js') {
    res.setHeader('content-type', 'application/javascript');
    file = 'build.js';
  }
  else if (req.url === '/style.css') {
    res.setHeader('content-type', 'text/css');
    file = 'style.css'; 
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
