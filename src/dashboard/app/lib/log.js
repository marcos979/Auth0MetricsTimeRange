var Bunyan = require('bunyan');

module.exports = new Bunyan({
  name: 'dashboard',
  level: process.env.log_level || 'info' // jshint ignore:line
});
