'use strict';

var restify = require('restify');

var packageJSON = require('../../package.json');
var log = require('./log');

var server = restify.createServer({
  name: packageJSON.name + ' ' + packageJSON.version,
  log: log
});

server
  .pre(restify.pre.sanitizePath())
  .use(restify.CORS())
  .use(restify.bodyParser())
  .use(restify.queryParser())
  .use(restify.gzipResponse()); 
  
server.on('after', restify.auditLogger({
    log: log
}));

server.on('uncaughtException', function (req, res, route, err) {
  req.log.error(err);

  if(process.env.node_env === 'development'){ // jshint ignore:line
    res.send(err);
  }else{
    res.send(new restify.InternalServerError('An error has ocurred'));
  }
});

server.on('InternalServer', function (req, res, err, cb) {
  req.log.error(err);
  return cb();
});

module.exports = server;
