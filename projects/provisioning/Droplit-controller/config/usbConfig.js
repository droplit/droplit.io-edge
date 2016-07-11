var fs = require('fs');
var child_process = require('child_process');
var log = require('./config-debug');

var importFileName = "/home/pi/usbdrv/droplit_wifi_config.txt";

var usbConfig = {
    checkForFile: checkForFile,
    config: config
}

function checkForFile() {

    if (fs.existsSync(importFileName)) {
        return true;
    }
    return false;
}

function config() {
    fs.exists(importFileName, function (exists) {
        if (exists) {
            fs.readFile(importFileName, 'utf8', function (err, data) {
                if (err) {
                    return log(err);
                }
                log(data);
                var items = data.split(";")
                var ssid = items[0];
                var psk = items[1];
                var email = items[2];
                configureNetworkingDevice(ssid, psk, function (result) {
                    if (result = "activated") {
                        connectToCloud(email);
                    }
                    if (result = "error") {

                    }
                })
            });
        }
    });
}

function configureNetworkingDevice(ssid, psk, callback) {
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
            callback("activated");
            return;
        }
        log("> command: " + commands[index]);
        child_process.exec(commands[index], function (err, stdout, stderr) {
            if (index != 0) {
                if (err) {                   
                    callback("error");
                    return;
                }
            }
            log(stdout);
            recursiveExec(commands, index + 1);
        });
    }
    if (psk == "" || psk == undefined) {
        recursiveExec(UnencryptedCommands);
    }
    else {
        recursiveExec(EncryptedCommands);
    }
}
function connectToCloud(email) {
    var self = this;
    log(email);
    log("Checking for an internet connection...");
    require('dns').resolve('www.google.com', function (err) {
        if (err) {
            log("Cannot connect to www.google.com resetting networking device...");
            self.emit('ready', "error");
        }
        else {
            log("Connection established. Sending token...");
            // connection            
            provisionTools.registerEmail(email, function (response) {
                log("Token sent. Callback: " + response);
                self.emit('ready', "success");
            });
        }
    });

}
module.exports = usbConfig;