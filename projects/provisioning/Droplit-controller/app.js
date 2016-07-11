var debug = require('debug');

var log = debug('hub');

console.log = log.bind(log);

var init = require('./init');
//Initilize ble config
init.bleConfig();
