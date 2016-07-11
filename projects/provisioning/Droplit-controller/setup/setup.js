var provisionTools = require('../lib/provisionTools');
var exec = require('child_process').exec;
var saltMaster = "nacl.droplit.io";
provisionTools.getControllerId(function (controllerId) {
    var timeStamp = getDateTime();
    exec('echo "id: ' + controllerId + timeStamp + '">> /etc/salt/minion', function (error, stdout, stderr) {
		// Sets salt-minion id to its mac address
        console.log("Id set to: " + controllerId + timeStamp);
        exec('echo "master: ' + saltMaster + '" >> /etc/salt/minion', function (error, stdout, stderr) {
            // Sets salt-minion master to the droplit salt-master server
            console.log("Salt-master set to: " + saltMaster);           
        });       
	});
});
function getDateTime() {

    var date = new Date();

    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    var min = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    var sec = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;

    var year = date.getFullYear();

    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    var day = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return "-" + year + ":" + month + ":" + day;

}
