console.log('Start');
var childProcess = require('child_process');
//http://rtl8192cu.googlecode.com/hg-history/bdd3a2265bdd6a92f24cef3d52fa594b2844c9c1/document/wpa_cli_with_wpa_supplicant.pdf
var ssid = "";
var psk = "";
var openNetworkCommands = [
    "wpa_cli remove_network 0",
    "wpa_cli add_network",
    "wpa_cli set_network 0 ssid '\""+ ssid + "\"'",
    "wpa_cli set_network 0 key_mgmt None",
    "wpa_cli select_network 0",
    "wpa_cli save_config 0"
];



ifconfig = childProcess.exec('ifconfig', function (error, stdout, stderr) {
    if (error) {
        console.log(error.stack);
        console.log('Error code: ' + error.code);
        console.log('Signal received: ' + error.signal);
    }
    console.log('Child Process STDOUT: ' + stdout);
    console.log('Child Process STDERR: ' + stderr);
});

ifconfig.on('exit', function (code) {
    console.log('Child process exited with exit code ' + code);
});

function sendCLICommands() {
    var index = 0;

}