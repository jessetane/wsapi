var thru = require('through2').obj;

module.exports = function(muxer) {
  return {

    // simple function
    hello: function(cb) {
      cb(null, 'oh hai');
    },

    // stream
    listen: function(cb) {
      var id = Math.random();
      var stream = muxer[id] = thru();
      var number = 0;
      var interval = setInterval(function() {
        stream.write('event: ' + number++);
      }, 2000);
      stream.on('end', function() {
        clearInterval(interval);
      });
      cb(null, id);
    },

  };
};
