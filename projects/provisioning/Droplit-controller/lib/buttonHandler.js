var suspawn = require('suspawn');

var Gpio = require('onoff').Gpio,
    led = new Gpio(4, 'out'),
    button = new Gpio(24, 'in', 'both');

// timer id's
var buttonHoldTimer = null;
var configModeTimeout = null;

// durations
var BUTTON_HOLD_DURATION = 3000;
var CONFIG_WINDOW_TIMEOUT = 30000;

// modes
var configMode = false;

ledOff();

button.watch(function(err, value) {
    if (err) exit();
    //console.log('button =', value);
    if (configMode == false) {
        if (value == 0) {
            startButtonHoldTimer();
        } else {
            cancelButtonHoldTimer();
        }
    } else {
        if (value == 0) {
            abortConfigMode();
        } else {

        }
    }
});

function ledOn() {
    led.writeSync(1);
}

function ledOff() {
    led.writeSync(0);
}

function startButtonHoldTimer() {
    //console.log('starting button hold timer');
    buttonHoldTimer = setTimeout(function() {
        buttonHoldTimer = null;
        startConfigMode();
    }, BUTTON_HOLD_DURATION);
}

function cancelButtonHoldTimer() {
    //console.log('button timer canceled');
    if (buttonHoldTimer) {
        clearTimeout(buttonHoldTimer);
        buttonHoldTimer = null;
    }
}

function startConfigMode() {
    //console.log('starting config mode');
    configMode = true;
    ledOn();
    runScript();
    configModeTimeout = setTimeout(function() {
        configModeTimeout = null;
        abortConfigMode();
    }, CONFIG_WINDOW_TIMEOUT);
}

function abortConfigMode() {
    //console.log('config mode aborted');
    configMode = false;
    ledOff();
    clearTimeout(configModeTimeout);
    configModeTimeout = null;
    // kill process
    killConfigProcess();
}

function sustainConfigMode() {
    //console.log('config mode sustained');
    clearTimeout(configModeTimeout);
    configModeTimeout = null;
}

function endConfigMode() {
    //console.log('config timed out or finished');
    configMode = false;
    ledOff();
}

// process management

var configProcess = null;

function runScript() {
    // -u flag disables output buffering
    // http://stackoverflow.com/questions/21886233/time-sleepx-not-working-as-it-should
    // http://stackoverflow.com/questions/107705/python-output-buffering
    configProcess = suspawn('python', ['-u', 'bt-wifi-config.py'], {env: process.env}); //, stdio: ['Stream', 'String', 'Stream']
    // also, this exists:
    // https://www.npmjs.org/package/python-shell

    configProcess.on('close', function (code, signal) {
        console.log('config process closed', code, signal);
    });

    configProcess.on('exit', function(code, signal) {
        console.log('config process exited', code, signal);
        endConfigMode();
    });

    configProcess.stdout.on('data', function (data) {
        console.log('stdout: ' + data);

        if (stringContains(data, 'await_connection')) {
            // the process is ready
            //console.log('the process is ready');
        } else if (stringContains(data, 'connection_open')) {
            // the mobile device has opened a connection; cancel the timeout
            sustainConfigMode();
        }
    });

    configProcess.stderr.on('data', function (data) {
        console.log('stderr: ' + data);
    });
}

function stringContains (str, contains) {
    return (str.toString().indexOf(contains) > -1);
}

function killConfigProcess() {
    if (configProcess) {
        configProcess.kill('SIGHUP');
        // wait a little bit
        setTimeout(function() {
            // then try again
            configProcess.kill('SIGHUP');
        }, 100);
    }
}