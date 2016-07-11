var child_process = require('child_process');
checkWirelessNetwork(function (result) {
    //Success
    console.log(result);
}, function (result) {
    //Error
    console.log(result);
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
        try{
            var essid = output[1];
            var accessPoint = output[2];
        }
        catch(err){
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