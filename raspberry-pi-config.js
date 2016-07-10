var commander = require('commander');
var exec = require('child_process').exec;
var installer = require('strong-service-install');

commander
    .command('install')
    .action(function () {
        var opts = {
            name: 'droplit-edge',
            author: 'Droplit, Inc',
            description: 'Droplit.io Edge Service',
            user: process.env.USER,
            command: 'node droplit-edge',
            cwd: '/home/pi/droplit.io-edge',
            systemd: true,
            force: true
        };
        installer(opts, function (err, result) {
            if (err) {
                console.error('Failed to install service:', err.message);
                process.exit(1);
            } else {
                console.log('Successfully installed service:', result);
                process.exit(0);
            }
        });
    });

commander
    .command('reload-service')
    .action(function () {
        reloadService();
    });

commander
    .command('restart-service')
    .action(function () {
        restartService();
    });

commander
    .command('reboot')
    .action(function () {
        rebootSystem();
    });

commander
    .command('shutdown')
    .action(function () {
        shutdownSystem();
    });

commander.parse(process.argv);







function runCommand(command, callback) {
    console.log('running command:', command);
    exec(command, function (error, stdout, stderr) {
        console.log('stdout: ' + stdout);
        console.log('stderr: ' + stderr);
        if (error !== null) {
            console.log('exec error: ' + error);
        }
        callback(error == null);
    });
}

function reloadService() {
    runCommand('sudo systemctl daemon-reload', function () {
        setTimeout(function () {
            restartService();
        }, 1000);
    });
}

function restartService() {
    runCommand('sudo service droplit-edge restart', function (success) {
        if (success) {
            process.exit(0);
        }
    });
}

function rebootSystem() {
    runCommand('sudo reboot', function () {
        // nop
    });
}

function shutdownSystem() {
    runCommand('sudo poweroff', function () {
        // nop
    });
}

