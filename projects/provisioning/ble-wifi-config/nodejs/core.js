var util = require('util');
var bleno = require('bleno');
var gateway = require('./gateway.js');
var UARTService = require('./uart-service');
var primaryService = new UARTService(new gateway.Gateway());

var deviceName = 'droplit-gateway';

bleno.on('stateChange', function (state) {
    console.log('on -> stateChange: ' + state);
    if (state === 'poweredOn') {
        bleno.startAdvertising(deviceName, [primaryService.uuid], function (err) {
            if (err) {
                console.log(err);
            }
        });
    } else {
        bleno.stopAdvertising();
    }
});

bleno.on('advertisingStart', function (error) {
    console.log('on -> advertisingStart: ' + (error ? 'error ' + error : 'success'));

    if (!error) {
        bleno.setServices([primaryService]);
    }
});