//#region Character constants
var END_OF_TRANS = String.fromCharCode(0x17);
var START_OF_TEXT = String.fromCharCode(0x02);
var RECORD_SEPARATOR = String.fromCharCode(0x1E);
//#endregion

var PythonShell = require('python-shell');
var child_process = require('child_process');

var util = require('util');
var events = require('events');

var WifiData = "";
var SetNetwork = "";


function Gateway() {
    events.EventEmitter.call(this);
    this.wifiData = WifiData;
    this.setNetwork = SetNetwork;

}
util.inherits(Gateway, events.EventEmitter);

Gateway.prototype.yo = function () {
    var self = this;
    console.log("Yo!")
    self.emit('ready');

}

Gateway.prototype.wifiScan = function () {
    var self = this;
    var options = {
        //Set python script location
        scriptPath: './python'
    };
    console.log("Scanning...");
    PythonShell.run('wifiSSIDs.py', options, function (err, results) {
        if (err) throw err;
        console.log('results: %j', results);
        console.log('Scan finished');
        WifiData = results;
        self.emit('ready', results);
    });
}
Gateway.prototype.setNet = function (ssid, psk) {
    console.log(psk);
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
        console.log("> command: " + commands[index]);
        child_process.exec(commands[index], function (err, stdout, stderr) {
            if (err) {
                console.log("child processes failed with error code: " + err.code);
                SetNetwork = "error";
                self.emit('ready', SetNetwork);
                return;
            } else {
                console.log(stdout);
                recursiveExec(commands, index + 1);
            }
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
    console.log(token);
    self.emit('ready', "success");
}
module.exports.Gateway = Gateway;
module.exports.WifiData = WifiData;
module.exports.SetNetwork = SetNetwork;