const exec = require('child_process').exec;
setTimeout(function () {
    exec('sudo /usr/bin/node /home/pi/droplit.io-edge/droplit-edge', (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);
    });
}, 10000)
