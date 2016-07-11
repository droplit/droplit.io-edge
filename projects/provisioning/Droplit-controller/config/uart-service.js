var util = require('util'),
  bleno = require('bleno'),
  BlenoPrimaryService = bleno.PrimaryService,
  //UARTTXCharacteristic = require('./uart-tx-characteristic'); Unused
  UARTRXCharacteristic = require('./uart-rx-characteristic');


function UARTService(gateway) {
    UARTService.super_.call(this, {
        uuid: '6a400001db2211e49ab60002a5d5c51b',
        characteristics: [
           // new UARTTXCharacteristic(),
            new UARTRXCharacteristic(gateway)
        ]
    });
}

util.inherits(UARTService, BlenoPrimaryService);

module.exports = UARTService;