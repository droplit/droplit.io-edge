//#region Character constants
var END_OF_TRANS = String.fromCharCode(0x17);
var START_OF_TEXT = String.fromCharCode(0x02);
var RECORD_SEPARATOR = String.fromCharCode(0x1E);
//#endregion
var provisionTools = require('../lib/provisionTools');
var fsUtil = require('droplit-cli-common').fsUtil;
var wifiscanner = require('../node_modules/node-wifiscanner/lib/wifiscanner.js');

var log = require('./config-debug');
var bleno = require('bleno');
var child_process = require('child_process');

var util = require('util');
var events = require('events');

//var WifiData = null;
var SetNetwork = "";

function Gateway() {
    events.EventEmitter.call(this);
    var self = this;
    self.wifiData = null;
    self.setNetwork = SetNetwork;
    self.BLEConnected = false;
    return self;
}
util.inherits(Gateway, events.EventEmitter);

Gateway.prototype.yo = function () {
    var self = this;
    log("Yo!")
    self.emit('ready');
}
Gateway.prototype.wifiScan = function () {
    var self = this;
    log("on > Scanning Wifi...");

    var counter = 0;
    wifiscanner.scan(function (err, data) {
        if (err) {
            log("Wifi scan error:", err);
            return;
        }
        results = JSON.stringify(data);
        Gateway.wifiData = results;
        self.emit('ready', results);
    });

}
Gateway.prototype.emitWifiScanResults = function () {
    var self = this;
    log("Emitting Scan results...");
    log(Gateway.wifiData);
    if (Gateway.wifiData != null) {
        self.emit('ready', Gateway.wifiData);
    }
}
Gateway.prototype.setNet = function (ssid, psk) {
    log(psk);
    var self = this;
    var UnencryptedCommands = [
        "wpa_cli remove_network 0",
        "wpa_cli add_network",
        "wpa_cli set_network 0 ssid '\"" + ssid + "\"'",
        "wpa_cli set_network 0 key_mgmt NONE",
        "wpa_cli select_network 0",
        "wpa_cli save_config"
    ];
    // for TKIP and AES
    var EncryptedCommands = [
        "wpa_cli remove_network 0",
        "wpa_cli add_network",
        "wpa_cli set_network 0 ssid '\"" + ssid + "\"'",
        "wpa_cli set_network 0 psk '\"" + psk + "\"'",
        "wpa_cli select_network 0",
        "wpa_cli save_config"
    ];
    function recursiveExec(commands, index) {
        if (index === undefined) index = 0;
        if (index == commands.length) {
            SetNetwork = "activated";
            self.emit('ready', SetNetwork);
            return;
        }
        log("> command: " + commands[index]);
        child_process.exec(commands[index], function (err, stdout, stderr) {
            if (index != 0) {
                if (err) {
                    log("child processes failed with error code: " + err.code);

                    SetNetwork = "error";
                    self.emit('ready', SetNetwork);
                    return;
                }
            }
            log(stdout);
            setTimeout(function () {
                recursiveExec(commands, index + 1);
            }, 500);
            
        });
    }
    if (psk == "") {
        recursiveExec(UnencryptedCommands);
    }
    else {
        recursiveExec(EncryptedCommands);
    }
}
Gateway.prototype.passToken = function (token) {
    var self = this;
    log(token);
    //Local storage
    var settings = fsUtil.readSettings();
    var success = fsUtil.updateSetting('userToken', token);
    if (success) {
        log('Token saved to local storage');
        self.emit('ready', "success");
    } else {
        log('Error saving token to local storage');
        self.emit('ready', "error");
    }
}
Gateway.prototype.uploadToken = function () {
    var self = this;
    //Local storage
    var settings = fsUtil.readSettings();
    var userToken = settings.userToken;
    log(userToken);

    provisionTools.registerUser(userToken, function (response) {
        log("Token sent. Callback: " + response);
        fsUtil.updateSetting('hasBeenSetup', true);
        fsUtil.deleteSetting("userToken");
        self.emit('ready', "success");
    });
}
Gateway.prototype.restartHub = function () {
    log("Restarting hub!");
    setTimeout(function () {
        bleno.stopAdvertising(function () {
            bleno.disconnect();
        });

        child_process.exec('sudo reboot', function (err, stdout, stderr) {
        });
    }, 1000);

}
Gateway.prototype.checkForNetworkConnection = function () {
    var self = this;
    checkWirelessNetwork(function (result) {
        //Success
        log(result);
        self.emit('ready', result.status);
    }, function (result) {
        //Error
        log(result);
        self.emit('ready', result.status);
    });
    function checkWirelessNetwork(successCallback, errorCallback) {
        child_process.exec('iwconfig', function (error, stdout, stderr) {
            var result = {};
            if (error) {
                //console.log(error.stack);
                //console.log('Error code: ' + error.code);
                //console.log('Signal received: ' + error.signal);
                result.status = "Error";
                result.error = { code: error.code, signal: error.signal };
                errorCallback(result);
                return;
            }
            // console.log('Child Process STDOUT: \n' + stdout);
            var parseReg = /wlan0.+?ESSID:"?([^"]*?)"?\s(?:\s|.)+?Access Point: (\S+)/gi;
            var output = parseReg.exec(stdout.toString());
            var macReg = /^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/; //Checks if a mac address  
            try {
                var essid = output[1];
                var accessPoint = output[2];
            }
            catch (err) {
                result.status = "Error";
                result.error = "Could not parse iwconfig";
                errorCallback(result);
                return;
            }
            if (essid == null || accessPoint == null) {
                result.status = "Error";
                result.error = "Could not parse iwconfig";
                errorCallback(result);
                return;
            }
            else {
                result.essid = essid;
                result.accessPoint = accessPoint;
                if (accessPoint == 'Not-Associated') {
                    //console.log('No network connection');
                    result.status = "Not-Associated";
                    successCallback(result);
                    return;
                }
                else {
                    var isValidMac = macReg.test(accessPoint)
                    if (isValidMac) {
                        //console.log("Connected to network");
                        result.status = "Connected";
                        successCallback(result);
                        return;
                    }
                    else {
                        //console.log("Error");
                        result.status = "Error";
                        result.error = "Could not determine network connection status";
                        errorCallback(result);
                        return;
                    }
                }

            }
        });
    }
}
Gateway.prototype.checkForInternetConnection = function () {
    var self = this;
    log("Checking for an Internet connection...");
    child_process.exec('ping -c 1 www.google.com', function (error, stdout, stderr) {
        if (error !== null) {
            log("Not available")
            self.emit('ready', 'not-connected');
        }
        else {
            log("Available")
            self.emit('ready', 'connected');

        }
    });
    /*require('dns').lookup('www.google.com', function (err) {
        if (err) {
            log("Cannot connect to www.google.com");
            self.emit('ready', 'not-connected');
        }
        else {
            log("Connection established.");
            self.emit('ready', 'connected');
        }
    });*/
}
module.exports.Gateway = Gateway;