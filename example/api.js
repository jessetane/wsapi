module.exports = function(muxer) {
  return {

    // simple function
    hello: function(cb) {
      cb(null, 'oh hai');
    },

    // stream
    startListening: function(cb) {
      var number = 0;
      var stream = muxer.createStream();
      var interval = setInterval(function() {
        stream.write('event: ' + number++);
      }, 2000);
      stream.on('finish', function() {
        console.log('listener ended', stream.meta)
        clearInterval(interval);
      });
      cb(null, stream.meta);
    },

  };
};
