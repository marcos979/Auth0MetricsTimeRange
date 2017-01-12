require('dotenv').config({silent: true});

var CronJob = require('cron').CronJob;

var getUsers = require('./getUsers');

var cronFrequency = process.env.cron_frequency || '* 0 * * * *'; //Default '* 0 * * * *' = una vez por hora.
cronFrequency = cronFrequency + '';

new CronJob(cronFrequency, function() {
  getUsers.runTask();  
}, null, true, 'America/Argentina/Buenos_Aires');
