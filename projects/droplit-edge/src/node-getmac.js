// Forked from https://www.npmjs.com/package/node-getmac
var fs = require('fs');
var path = require('path');
const DROPLIT_ROOT = '.droplit.io';

if(fs.existsSync(path.join('projects', 'droplit-edge', 'localsettings.json')) == true){
    var localSettings = require('../localsettings.json');
} else {
    var localSettings = require(path.join(droplitDir(), 'localsettings.json'));  
}
var execSync = require('child_process').execSync;
var platform = process.platform;

module.exports = (function () {
    var linuxNetInterface = (localSettings.config && localSettings.config.LinuxNetInterfaceOverride) ?
        localSettings.config.LinuxNetInterfaceOverride :
        'eth0';
    var cmd = {
        win32: 'getmac',
        darwin: 'ifconfig -a',
        linux: 'cat /sys/class/net/' + linuxNetInterface + '/address'
    }[platform];

    var regStr = '((?:[a-z0-9]{2}[:-]){5}[a-z0-9]{2})';

    try {
        var data = execSync(cmd).toString();
        var res = {
            win32: new RegExp(regStr, 'i').exec(data),
            darwin: new RegExp('ether\\s' + regStr + '\\s', 'i').exec(data),
            linux: ['', data]
        }[platform];

        if (res) {
            return res[1];
        }
    }
    catch (e) {
        return '';
    }
})();

function droplitDir() {
    var homeFolder = false;
    if (process.env.HOME !== undefined) {
        homeFolder = path.join(process.env.HOME, DROPLIT_ROOT);
    }
    if (process.env.HOMEDRIVE && process.env.HOMEPATH) {
        homeFolder = path.join(process.env.HOMEDRIVE, process.env.HOMEPATH, DROPLIT_ROOT);
    }
    if (!homeFolder) {
        fs.mkdirSync(homeFolder, 502); // 0766
    }
    return homeFolder;
}