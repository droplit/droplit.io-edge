var child_process = require('child_process');

var devices = [];


function listUsbDeviceJSON(successCallback, errorCallback, params) {

}
function getAllUsbDevices(successCallback, errorCallback) {
    child_process.exec("lshw", function (err, stdout, stderr) {
        if (err) {
            console.log("child processes failed with error code: " +
                err.code);
        }
        //console.log(stdout);
        //successCallback(results);
    });
}
function getWirelessNetworkingDeviceDriver(successCallback, errorCallback) {
    var results = {};
    var regexp = /\*-[^\*]*?description: wireless interface[^\*]*?configuration:[\s\S]*?driver=([\S]*)[\s\S]*?(?=\*)/gim;
    child_process.exec("lshw -C Network", function (err, stdout, stderr) {
        if (err) {
            console.log("child processes failed with error code: " +
                err.code);
        }
        stdout += "*";
        console.log(stdout);
        results.driver = regexp.exec(stdout)[1];
        console.log(results.driver);
        successCallback(results);
    });

}
function getUsbInfoByDriver(successCallback, errorCallback, params) {
    var results = {};
    // myregexstring '\*[^\*]*?bus\s(\d+)[^\*]*dev\s(\d+)[^\*]*?driver='+ params.driver + '[^\*]*?(?=\*)'	
    var regexp = new RegExp('\\*[^\\*]*?bus\\s(\\d+)[^\\*]*dev\\s(\\d+)[^\\*]*?driver=' + params.driver + '[^\\*]*?(?=\\*)', 'gim');
    child_process.exec("lsusb -t", function (err, stdout, stderr) {
        if (err) {
            console.log("child processes failed with error code: " +
                err.code);
        }
        stdout = stdout.replace(/\/:/gim, "*");
        stdout += "*";
        console.log(stdout);
        var capture = regexp.exec(stdout);
        console.log("Bus: " + pad(capture[1]));
        console.log("Dev: " + pad(capture[2]));
        results.bus = pad(capture[1]);
        results.device = pad(capture[2]);
        successCallback(results);
    });
    function pad(str) {
        str = str.toString();
        return str.length < 3 ? pad("0" + str, 3) : str;
    }
}
function resetDevice(successCallback, errorCallback, params) {
    var results = {};
    child_process.exec("sudo /home/pi/droplitcontroller/unplug/usb-reset /dev/bus/usb/" + params.bus + "/" + params.device, function (err, stdout, stderr) {
        if (err) {
            console.log("child processes failed with error code: " +
                err.code);
        }

        results.status = "reset";
        successCallback(results);
    });
}
function connectDevice(successCallback, errorCallback, params) {
    var results = {};
    child_process.exec("sudo /home/pi/droplitcontroller/unplug/usb-connect /dev/bus/usb/" + params.bus + "/" + params.device, function (err, stdout, stderr) {
        if (err) {
            console.log("child processes failed with error code: " +
                err.code);
        }

        results.status = "reset";
        successCallback(results);
    });
}
function disconnectDevice(successCallback, errorCallback, params) {
    var results = {};
    child_process.exec("sudo /home/pi/droplitcontroller/unplug/usb-disconnect /dev/bus/usb/" + params.bus + "/" + params.device, function (err, stdout, stderr) {
        if (err) {
            console.log("child processes failed with error code: " +
                err.code);
        }

        results.status = "reset";
        successCallback(results);
    });
}
function resetNetworkStack(successCallback, errorCallback) {
    var results = {};
    child_process.exec("sudo ifdown wlan0", function (err, stdout, stderr) {
        if (err) {
            console.log("child processes failed with error code: " +
                err.code);
        }

        child_process.exec("sudo ifup wlan0", function (err, stdout, stderr) {
            if (err) {
                console.log("child processes failed with error code: " +
                    err.code);
                results.status = err.code;
            }
            else {
                results.status = "reset";
                successCallback(results);
            }
        });
    });
}
var resetWirelessNetworkingDevice = function (successCallback, errorCallback) {
    getWirelessNetworkingDeviceDriver(
         function (results) {
             getUsbInfoByDriver(
                 function (results) {
                     resetDevice(
                         function (results) {
                             setTimeout(function () {
                                 resetNetworkStack(function (results) {
                                     var result = {};
                                     result.status = "Wireless networking device reset."
                                     successCallback(result);
                                 }, errorCallback);
                             }, 20000);
                         },
                         errorCallback,
                         results)
                 },
                 errorCallback,
                 results);
         }, errorCallback);
}
function errorCallback() {
    throw ("error callback");
}

module.exports.resetWirelessNetworkingDevice = resetWirelessNetworkingDevice;