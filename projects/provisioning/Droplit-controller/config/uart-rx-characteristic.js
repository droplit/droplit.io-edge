//#region Character constants
var END_OF_TRANS = String.fromCharCode(0x17);
var START_OF_TEXT = String.fromCharCode(0x02);
var RECORD_SEPARATOR = String.fromCharCode(0x1E);
var BLE_MSG_LENGTH = 20;
//#endregion

var util = require('util');
var bleno = require('bleno');
var gateway = require('./gateway');
var log = require('./config-debug');
var Descriptor = bleno.Descriptor;
var Characteristic = bleno.Characteristic;

var CommandString = "";
var CommandReceived = "";
var CommandData = new Array();
var WifiData = null;

function UARTRXCharacteristic(gateway) {
    Characteristic.call(this, {
        uuid: '6a400003db2211e49ab60002a5d5c51b',
        properties: ['notify', 'write'],
        onSubscribe: function (maxValueSize, updateValueCallback) {
            this.updateValueCallback = updateValueCallback;
            updateValueCallback(new Buffer('Connected', 'utf8'));
            //Emmits scan data on connection
            log("on > Device Connected");
            gateway.BLEConnected = true;
        }
    });
    this.gateway = gateway;
    //Scans wifi networks on start
    this.gateway.wifiScan();
    this.gateway.once('ready', function (results) {
        log(results);
        WifiData = results;

    });
}

util.inherits(UARTRXCharacteristic, Characteristic);

UARTRXCharacteristic.prototype.onWriteRequest = function (data, offset, withoutResponse, callback) {
    var self = this;
    var receivedData = data.toString();
    log("Data received: " + receivedData);
    if (receivedData.indexOf(START_OF_TEXT) > -1) {
        CommandReceived = "";
        CommandData = new Array();
        CommandString = "";
    }
    CommandString += receivedData.replace(START_OF_TEXT, '').replace(END_OF_TRANS, '');

    if (receivedData.indexOf(END_OF_TRANS) > -1) {
        CommandData = CommandString.split(RECORD_SEPARATOR);
        CommandReceived = CommandData[0];
        switch (CommandReceived) {
            case "wifiScan": {
                //Creates listener for when wifiScan() completes
                this.gateway.once('ready', function (result) {
                    log("Sending wifiScan notification...");
                    sendNotification(START_OF_TEXT + 'wifiScan' + RECORD_SEPARATOR + result + END_OF_TRANS, self)
                });
                this.gateway.wifiScan();
                break;
            }
            case "requestWifiData": {
                log("requestWifiData received. Current scan data:");
                log(WifiData);
                if (WifiData != null) {
                    log("Sending requestWifiData notification...");
                    sendNotification(START_OF_TEXT + 'wifiScan' + RECORD_SEPARATOR + WifiData + END_OF_TRANS, self);
                }
                else {
                    log("Wifi scan not complete.");
                    this.gateway.once('ready', function () {
                        log("Sending requestWifiData notification...");
                        sendNotification(START_OF_TEXT + 'wifiScan' + RECORD_SEPARATOR + WifiData + END_OF_TRANS, self);
                    });
                }
                break;
            }
            case "passToken": {
                this.gateway.once('ready', function (result) {
                    sendNotification(START_OF_TEXT + 'passToken' + RECORD_SEPARATOR + result + END_OF_TRANS, self);
                });
                this.gateway.passToken(CommandData[1]);
                break;
            }
            case "uploadToken": {
                this.gateway.once('ready', function (result) {
                    if (result == 'success') {
                        sendNotification(START_OF_TEXT + 'uploadToken' + RECORD_SEPARATOR + result + END_OF_TRANS, self);
                    }
                });
                this.gateway.uploadToken();
                break;
            }
            case "setNet": {
                this.gateway.once('ready', function (result) {
                    sendNotification(START_OF_TEXT + 'setNet' + RECORD_SEPARATOR + result + END_OF_TRANS, self)
                });
                this.gateway.setNet(CommandData[1], CommandData[2]);
                break;
            }
            case "checkNet": {
                this.gateway.once('ready', function (result) {
                    sendNotification(START_OF_TEXT + 'checkNet' + RECORD_SEPARATOR + JSON.stringify(result) + END_OF_TRANS, self)
                });
                this.gateway.checkForNetworkConnection();
                break;
            }
            case "checkInternet": {
                this.gateway.once('ready', function (result) {
                    sendNotification(START_OF_TEXT + 'checkInternet' + RECORD_SEPARATOR + result + END_OF_TRANS, self)
                });
                this.gateway.checkForInternetConnection();
                break;
            }
            case "rebootAck": {
                this.gateway.restartHub();
                break;
            }
            case "yo": {
                this.gateway.once('ready', function (result) {
                    sendNotification(START_OF_TEXT + "YO!" + END_OF_TRANS, self);
                });
                this.gateway.yo();
                break;
            }
            default: {
                log("Beep boop?");
                log("Command Received: " + CommandReceived);
            }
        }      
    }
    
    function sendNotification(results, prototype) {
        for (var index = 0; index < results.length; index += BLE_MSG_LENGTH) {
            var data = "";
            if (index + BLE_MSG_LENGTH > results.Length) {
                data = results.substring(index, results.length - 1);
            }
            else {
                data = results.substring(index, BLE_MSG_LENGTH + index);

            }
            log(index + ": " + data);
            prototype.updateValueCallback(new Buffer(data, 'utf8'));
        }
    }
    callback(this.RESULT_SUCCESS);
}

module.exports = UARTRXCharacteristic;







