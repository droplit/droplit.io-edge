var util = require('util');
var bleno = require('bleno');
var gateway = require('./gateway.js');
var UARTService = require('./uart-service');
var log = require('./config-debug');
var provisionTools = require('../lib/provisionTools');
var primaryService = new UARTService(new gateway.Gateway());

var deviceName = 'Droplit Hub';
var enable = function() {
    provisionTools.getControllerId(function (controllerId) {
        var parts = controllerId.split(':');
        controllerId = parts[parts.length - 2] + ":" + parts[parts.length - 1];
        deviceName = deviceName + " " + controllerId;
        bleno.startAdvertising(deviceName, [primaryService.uuid], function (err) {
            if (err) {
                log(err);
            }
        });
    });
   
}
var disable = function () {
    log("Advertising stopped");
    bleno.stopAdvertising();
}
/*
bleno.on('stateChange', function (state) {
    config.log('on -> stateChange: ' + state);
    if (state === 'poweredOn') {
        
    } else {
        bleno.stopAdvertising();
    }
});
*/
bleno.on('advertisingStart', function (error) {
    log('on -> advertisingStart: ' + (error ? 'error ' + error : 'success'));
    log(error ? '' + error : "Device name: " + deviceName);
    if (!error) {
        bleno.setServices([primaryService]);
    }
});
module.exports = {
    enable: enable,
    disable: disable
}