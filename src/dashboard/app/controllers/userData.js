'use restrict'

var MongoClient = require('mongodb').MongoClient;

//var mongoDbConnectionString = process.env.mongodb_connectionString;
//var mongoDbConnectionString = process.env.mongodb_connection_string;
var config  = require('../lib/config');

module.exports = {

  list: function listAll(req, res, next){
    if(global.db){
      listUsers(req, res);
    }
    else{
      //MongoClient.connect(mongoDbConnectionString)
      MongoClient.connect(config.connectionString)
        .then(function(db){
          global.db = db;
          listUsers(req, res);
        })
      .catch(err => {console.log(err);res.json(err).end()});
    }
  }

}

function listUsers (req, res) {
    global.db.collection('users').find(req.filter).toArray(function(err, docs) {
        res.json(docs).end();
    });
  }