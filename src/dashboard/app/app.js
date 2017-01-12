var restify = require('restify');

var server = require('./lib/server');

var userData = require('./controllers/userData');

var config  = require('./lib/config');


server.get(/\/?.*/, restify.serveStatic({
	'directory': __dirname + '/public/',
	'default': 'index.html'
}));

server.post('/dashboard_endpoint', userData.list);


server.listen(config.port, function() {
  console.log('%s listening at %s', server.name, server.url);
});
