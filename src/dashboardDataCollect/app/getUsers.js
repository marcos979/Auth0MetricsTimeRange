
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var Promise = require("bluebird");
var request = Promise.promisify(require("request"));
var _ = require('lodash');
var moment = require('moment');

var isRunning = false;

var conf = {
  mongo_connection_string : process.env.mongodb_connection_string,
  domain : process.env.auth0_domain,
  app_token : process.env.auth0_token,
  page_size : 100, //Maximum allowed value 100. Limited by the Auth0 API.
  search_engine :  'v2'
};


var cb  = function(state, message){
          isRunning = false;
          console.log('CALLBACK - state: %s, message: %s', state, message);
        };


        
module.exports = {
    runTask: function(){      
        console.log('Running state: %s', isRunning);
        

        if(!isRunning){
          isRunning = true;
          
          MongoClient.connect(conf.mongo_connection_string)
            .then(function(db){
              conf.db = db;
              updateUsersData(cb, conf);
            })
          .catch(err => {
            console.log(err);
            isRunning = false;
          });
          
        }        
    }
    
}


   function updateUsersData(cb, conf) {
    conf.db.collection('settings').findOne( { setting: 'last_sync' }, function(err, doc) {
      load_data(cb, conf, 0, '', true, (doc && doc.value) || null);
    });
  }




function load_data(cb, conf, page, filter, first, last_sync) {

  if (typeof(page) === 'undefined') page = 0;
  if (typeof(first) === 'undefined') first = false;

  filter = filter || '';
  if (last_sync !== null) {
    var from_date = last_sync.toISOString();
    filter = "last_login:[" + from_date + " TO *]";
  }

  console.log("DATA INITIALIZE: Loading page " + page);
  console.log("\t Filter: ", filter);

  get_users(conf, filter, page, conf.page_size).then(function(content) {

    if (content && content.length > 0 && content!=='error') {

      console.log("\t PROCESING: "+content.length+" users");


      var itemsToProcess = _.map(content, function(user){
        return {
          updateOne:{
            filter:{user_id: user.user_id},
            update: mapper(user),
            upsert: true
          }
        };
      });


      conf.db.collection('users').bulkWrite( 
        itemsToProcess,
        { ordered : false }  //unordered operations continue to process any remaining write operations in the queue.
      );

         
      console.log("\t DONE");


      if (content.length === conf.page_size) {
        load_data(cb, conf, page+1, filter, first, last_sync);
      } else {
        update_last_sync(conf, cb);
      }

    }
    else {
      console.log("\t NO UPDATES");

      conf.db.close();
      cb(null, 'DONE');
    }

  }).catch(function(e){
    console.log('error', e);

    conf.db.close();
    cb(null, 'DONE, with errors');
  });

}


function update_last_sync(conf,cb) {
  conf.db.collection('settings').update({ setting: 'last_sync' }, { setting: 'last_sync', value: (new Date()) }, {upsert:true}, function() {    
    conf.db.close();
    console.log('closed');
    cb(null, 'DONE');
  });
}

function get_users(conf, q, page, per_page) {

  return request({
    url:"https://"+conf.domain+"/api/v2/users",
    timeout: 5000,
    headers: {
      "Authorization": "Bearer " + conf.app_token
    },
    qs: {
      search_engine:conf.search_engine,
      q:q,
      page:page,
      per_page:per_page
    }
  }).then(function(response) {
    if(response.statusCode !== 200){
        console.log('\n body: %s \n', response.body);
        return 'error';
    }
    
    return JSON.parse(response.body);

  }).catch(function(err) {
    console.log('Error %s', err);
  });

}




// ------------------------------------------------------------------- MAPPERS

var mappers = [
  user_id_mapper(),
  gender_mapper(),
  age_mapper(),
  created_at_mapper(),
  idp_mapper(),
  location_mapper(),
  zipcode_mapper(),
  income_mapper()
];

function mapper(user) {
  var mapped_user = {};
  user.user_metadata = user.user_metadata || {};
  user.app_metadata = user.app_metadata || {};

  mappers.forEach(function(c) {
    mapped_user = c(mapped_user, user);
  });

  return mapped_user;
}

function zipcode_mapper() {

  return function (mapped_user, user) {

    var geoip = user.user_metadata.geoip || user.app_metadata.geoip;

    mapped_user.zipcode = (geoip && geoip.postal_code) || null;

    return mapped_user;
  };
}
function user_id_mapper() {

  return function (mapped_user, user) {

    mapped_user.user_id = user.user_id;

    return mapped_user;
  };
}
function location_mapper() {

  return  function (mapped_user, user) {

    var geoip = user.user_metadata.geoip || user.app_metadata.geoip;
    var location = null;

    if (geoip && geoip.latitude && geoip.longitude) {
      location = {
        latitude: geoip.latitude,
        longitude: geoip.longitude
      };
    }

    mapped_user.location = location;

    return mapped_user;
  };
}
function income_mapper() {

  return function (mapped_user, user) {

    var income = user.user_metadata.zipcode_income || user.app_metadata.zipcode_income || null;

    mapped_user.income = income;

    return mapped_user;
  };
}
function idp_mapper() {

  return function (mapped_user, user) {

    mapped_user.idp = user.identities.map(function(identity) {
      return identity.provider;
    });

    return mapped_user;
  };
}
function gender_mapper() {

    return function (mapped_user, user) {
      mapped_user.gender = getGender(user);
      return mapped_user;
    };
}

function getGender(user) {
    if (user.gender) {
        return user.gender.toLowerCase();
    }

    var fullContactInfo = user.user_metadata.fullContactInfo || user.app_metadata.fullContactInfo;

    if (fullContactInfo && fullContactInfo.demographics && fullContactInfo.demographics.gender) {
      return fullContactInfo.demographics.gender.toLowerCase();
    }

    return null;
}
function created_at_mapper() {
  return function (mapped_user, user) {
    mapped_user.created_at = user.created_at;
    return mapped_user;
  };
}
function age_mapper() {
    var buckets = buildAgeBuckets(20, 70, 5);

    return function (mapped_user, user) {

        mapped_user.age = getAge(user);

        if (mapped_user.age === null) {
            mapped_user.agebucket = null;
        } else {

            buckets.forEach(function(bucket){

                if (mapped_user.age >= bucket.from && mapped_user.age <= bucket.to) {
                    mapped_user.agebucket = bucket.name;
                }

            });
        }

        return mapped_user;
    };
}

function buildAgeBuckets(from, to, step) {
    buckets = [];

    buckets.push({
        from:0,
        to:from-1,
        name: '< ' + (from - 1)
    });

    for (a = from; a < to; a += step) {
        buckets.push({
            from:a,
            to: a + step - 1,
            name: step === 1 ? a : ( a + '-' + (a + step - 1))
        });
    }

    buckets.push({
        from:to,
        to:200,
        name: '> ' + to
    });

    return buckets;
}

function getAge(user) {
    if (user.age) {
        return user.age;
    }

    var fullContactInfo = user.user_metadata.fullContactInfo || user.app_metadata.fullContactInfo;

    if (fullContactInfo && fullContactInfo.age) {
        return fullContactInfo.age;
    }
    if (fullContactInfo && fullContactInfo.demographics && fullContactInfo.demographics.age) {
        return fullContactInfo.demographics.age;
    }
    if (fullContactInfo && fullContactInfo.demographics && fullContactInfo.demographics.birthDate) {
        return moment().diff(fullContactInfo.demographics.birthDate, 'years');
    }

    if (user.dateOfBirth) {
        return moment().diff(user.dateOfBirth, 'years');
    }

    if (user.birthday) {
        //return moment().diff(user.birthday, 'years');
        return moment().diff(moment(user.birthday, "DD/MM/YYYY"), 'years');
    }

    return null;
}

