var util = require('util'),
  os = require('os'),
  exec = require('child_process').exec,
  bleno = require('bleno'),
  Descriptor = bleno.Descriptor,
  Characteristic = bleno.Characteristic;

var UARTTXCharacteristic = function () {
    UARTTXCharacteristic.super_.call(this, {
        uuid: '6a400002db2211e49ab60002a5d5c51b',
        properties: ['read']
    });
};

util.inherits(UARTTXCharacteristic, Characteristic);

UARTTXCharacteristic.prototype.onReadRequest = function (offset, callback) {
    console.log("Characteristic read");
    callback(this.RESULT_SUCCESS, new Buffer([98]));

};

module.exports = UARTTXCharacteristic;