var wsapi = require('../');

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

// leak api so you can access it from your console
window.api = api;
