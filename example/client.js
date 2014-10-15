var wsapi = require('../');
var api = wsapi();

api.on('connect', function() {

  // basic function
  api.methods.hello(function(err, res) {
    console.log(res);
  });

  // stream
  api.methods.startListening(function(err, id) {
    api.on('stream', onstream);
    function onstream(stream) {
      if (stream.meta === id) {
        api.removeListener('stream', onstream);
        stream.on('data', function(data) {
          console.log(data.toString());
        });
        stream.on('end', function() {
          console.log('broadcaster ended', stream.meta);
        });
      }
    }
  });

});

// leak api so you can access it from your console
window.api = api;
