var PythonShell = require('python-shell');


var options = {
    //Set python script location
    scriptPath: '../python'
};

PythonShell.run('wifiSSIDs.py', options, function (err, results) {
    if (err) throw err;
    console.log('finished');
    console.log('results: %j', results);

});