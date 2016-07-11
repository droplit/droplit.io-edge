//#region Character constants
var END_OF_TRANS = String.fromCharCode(0x17);
var START_OF_TEXT = String.fromCharCode(0x02);
var RECORD_SEPARATOR = String.fromCharCode(0x1E);
var BLE_MSG_LENGTH = 17;
//#endregion
//#region Bleno


var util = require('util');
var bleno = require('bleno');
var gateway = require('./gateway');

var os = require('os');
var exec = require('child_process').exec;
var Descriptor = bleno.Descriptor;
var Characteristic = bleno.Characteristic;

var CommandString = "";
var CommandReceived = "";
var CommandData = new Array();


function UARTRXCharacteristic(gateway) {
    Characteristic.call(this, {
        uuid: '6a400003db2211e49ab60002a5d5c51b',
        properties: ['notify', 'write'],
        onSubscribe: function (maxValueSize, updateValueCallback) {

            this.updateValueCallback = updateValueCallback;
            updateValueCallback(new Buffer('Connected', 'utf8'));

        }
    });
    this.gateway = gateway
};

util.inherits(UARTRXCharacteristic, Characteristic);

UARTRXCharacteristic.prototype.onWriteRequest = function (data, offset, withoutResponse, callback) {
    var self = this;
    //#region TODO add timeout

    //startTimeout(); 

    // if (timeoutProtect) {

    // Clear the scheduled timeout handler
    //    clearTimeout(timeoutProtect);

    // Run the real callback.
    //    callback();

    //   }
    //#endregion
    //Data sent as plain text
    var receivedData = data.toString();
    console.log("Data received: " + receivedData);
    if (receivedData.indexOf(START_OF_TEXT) > -1) {
        CommandReceived = "";
        CommandData = new Array();
        CommandString = "";
    }
    CommandString += receivedData.replace(START_OF_TEXT, '').replace(END_OF_TRANS, '');

    //#region handle command
    if (receivedData.indexOf(END_OF_TRANS) > -1) {
        //clearTimeout(timeoutProtect); // Clear the scheduled timeout handler
        CommandData = CommandString.split(RECORD_SEPARATOR);
        CommandReceived = CommandData[0];
        if (CommandReceived == "wifiScan") {
            //Creates listener for when wifiScan() completes
            this.gateway.once('ready', function (result) {
                console.log("send notification");
                sendNotification(START_OF_TEXT + 'wifiScan' + RECORD_SEPARATOR + result + END_OF_TRANS, self)
            });
            this.gateway.wifiScan();
        }
        else if (CommandReceived == "passToken") {
            //Creates listener for when passToken() completes
            this.gateway.once('ready', function (result) {
                sendNotification(START_OF_TEXT + 'passToken' + RECORD_SEPARATOR + result + END_OF_TRANS, self)
            });
            this.gateway.passToken(CommandData[1]);
        } else if (CommandReceived == "setNet") {
            //Creates listener for when setNetwork() completes
            this.gateway.once('ready', function (result) {
                sendNotification(START_OF_TEXT + 'setNet' + RECORD_SEPARATOR + result + END_OF_TRANS, self)
            });
            this.gateway.setNet(CommandData[1], CommandData[2]);
        } else {
            if (CommandReceived.toLowerCase() == "yo") {
                this.gateway.once('ready', function (result) {

                    sendNotification(START_OF_TEXT + "YO!" + END_OF_TRANS, self)
                });

                this.gateway.yo();
            }

            else {
                console.log("Beep boop?");
                console.log("Command Received: " + CommandReceived);

            }
        }
    }
    //#endregion
    function sendNotification(results, prototype) {
        for (var index = 0; index < results.length; index += BLE_MSG_LENGTH) {
            var data = "";
            if (index + BLE_MSG_LENGTH > results.Length) {
                data = results.substring(index, results.length - 1);
            }
            else {
                data = results.substring(index, BLE_MSG_LENGTH + index);

            }
            console.log(index + ": " + data);
            prototype.updateValueCallback(new Buffer(data, 'utf8'));
        }
    }
    callback(this.RESULT_SUCCESS);

};
//TODO add timeout
var timeoutProtect;

function startTimeout() {
    clearTimeout(timeoutProtect);
    timeoutProtect = setTimeout(function () {

        // Clear the local timer variable, indicating the timeout has been triggered.
        timeoutProtect = null;

        // Execute the callback with an error argument.
        console.log("Command timed out.");
        CommandReceived = "";
        CommandData = new Array();
        CommandString = "";
        callback({ error: 'async timed out' });
    }, 5000);
}
module.exports = UARTRXCharacteristic;
//#endregion







