//Forked from https://www.npmjs.com/package/node-getmac
var execSync = require('child_process').execSync;
var platform = process.platform;

module.exports = (function () {
    var cmd = {
        win32: 'getmac',
        darwin: 'ifconfig -a',
        linux: 'cat /sys/class/net/eth0/address'
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