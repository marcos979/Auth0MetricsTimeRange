require('dotenv').config({silent: true});

module.exports = {
  /* jshint ignore:start */
  connectionString: process.env.mongodb_connection_string,
  port:     process.env.port || 7020,
  basePath: process.env.base_path || ''
  /* jshint ignore:end */
};
