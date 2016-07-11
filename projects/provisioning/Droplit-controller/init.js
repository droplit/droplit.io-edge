// global exception handler
process.on('uncaughtException', function (err) {
    console.error('uncaught exception %s', err.stack);
});

// load config for everyone
global.config = require('./config.json');
// apply default server config
config.server = config[config.host].server; // default the server settings
// load settings
var fsUtil = require('droplit-cli-common').fsUtil;
var settings = fsUtil.readSettings();
// Provisioning tools
var provisionTools = require('./lib/provisionTools.js');

// var moment = require('moment');
// var fs = require('fs');
// var logFile = `/tmp/droplitctrl-${Date.now()}.log`;
// fs.writeFileSync(logFile, `Log Start - ${new Date().toString()}\n`, {flags: 'w'} );
// 
// var startTime = Date.now();
// setInterval(function () {
//     var currentTime = new Date();
//     var output = `${currentTime.toString()} +${moment(startTime).fromNow(true)}`; 
//     console.log(output);
//     fs.appendFile(logFile, '\n' + output);
// }, 1000 * 60 * 15);

// apply server config from settings
if (fsUtil.validValue(settings.host)) {
    config.server = config[settings.host].server;
}

exports.configureApp = function () {
    // initialize hardware here
    var buttonHandler = require('./lib/buttonHandler');


    // initialize routers here
}
exports.bleConfig = function () {
    var usbConfig = require('./config/usbConfig');
    if (usbConfig.checkForFile()) {
        usbConfig.config();
    }
    else {
        var setUpTime = 5; //Minutes
        var bleConfig = require('./config/bleConfig');
        bleConfig.enable();
        // Stays in setup mode if not net up before
        if (settings.hasBeenSetup) {
            setTimeout(function () {
                bleConfig.disable();
            }, setUpTime * 60 * 1000);
        }
    }
}

exports.configureServer = function (server) {
    // initialize hosted sockets here
}

// connect to droplit cloud service
var socketClient = require('socket.io-client');
var serverSocket = socketClient.connect(config.server.url);

function socketStatus(connStatus) {
    //fs.appendFile(logFile, `\nsocket status: ${connStatus}`);
    console.log('socket status: ' + connStatus);
}

serverSocket.on('connect', function () {
    socketStatus('connected');
    authenticateSocket(serverSocket, function () {
        // Handle stored user token during setup process

        //var userToken = settings.userToken;
        /*if (userToken) {
            provisionTools.registerUser(userToken, function (response) {
                console.log("Token sent. Callback: " + response);
                fsUtil.updateSetting('hasBeenSetup', true);
                fsUtil.deleteSetting("userToken");
            });
        }*/

        //loadBluetooth();
        loadPlugins();
        // TODO: Implement an update-required mode
        checkForUpdate(serverSocket, function(updateInfo) {
            if (updateInfo.update) {
                // download update
                performUpdate(updateInfo);
            }
        });
    })
});

// Set up event handlers that only log that they happened
['connect_failed', 'connect_timeout', 'disconnect', 'error', 'reconnect', 'reconnect_failed', 'reconnecting']
    .forEach((eventName) => {
        serverSocket.on(eventName, socketStatus.bind(this, eventName));
    });

// handle lost authentication
serverSocket.on('authenticate', function () {
    socketStatus('re-authenticating');
    authenticateSocket(serverSocket, function () {

    });
});

var provisionTools = require('./lib/provisionTools');

provisionTools.setRegisterCall(function (userInfo, callback) {
    // do this when a user registers to this hub
    console.log("user token before socket emit: ", userInfo);
    serverSocket.emit('register user', userInfo, function (response) {
        // returns {success: true} or {success: false }
        console.log("user token emit callback");
        if (callback) callback(response);
    });
});

function authenticateSocket(socket, callback) {
    provisionTools.getControllerId(function (controllerId) {
        var properties = {
            ipAddress: getIps(),
            softwareVersion: getCurrentPackage(),
            platfiormInfo: getPlatformInfo()
        };
        socket.emit('controller authenticate', { "controllerId": controllerId, "properties": properties }, function (response) {
            console.log('Controller ID: %s Authenticated: %s', controllerId, JSON.stringify(response));
            callback();
        });
    });
}

function getIps() {
    var os = require('os');
    var ifaces = os.networkInterfaces();
    var ips = [];
    Object.keys(ifaces).forEach(function (ifname) {
    var alias = 0;
    
        ifaces[ifname].forEach(function (iface) {
            if ('IPv4' !== iface.family || iface.internal !== false) {
                // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                return;
            }
        
            var ip = {};
            if (alias >= 1) {
                // this single interface has multiple ipv4 addresses
                //console.log(ifname + ':' + alias, iface.address);
                ip[ifname.concat('-', alias.toString())] = iface.address;
            } else {
                // this interface has only one ipv4 adress
                //console.log(ifname, iface.address);
                ip[ifname] = iface.address;
            }
            ips.push(ip);
            ++alias;
        });
    });
    return ips;
}

function getPlatformInfo() {
    var os = require('os');
    return {
        cpu: os.cpus()[0].model,
        osPlatform: os.platform(),
        osVersion: os.release(),
        hostname: os.hostname()
    };
}

function checkForUpdate(socket, callback) {
    var currentPackage = getCurrentPackage();
    console.log('checking update for', currentPackage);
    socket.emit('update hub', {}, function (updateInfo) {
        console.log('Sw Version: %s Upddate: %s', currentPackage, updateInfo.packageName);
        updateInfo.update = updateInfo.packageName != undefined && currentPackage != updateInfo.packageName;
        callback(updateInfo);
    });
}

function getCurrentPackage() {
    var currentPackage;
    if (settings.currentPackage) {
        currentPackage = settings.currentPackage;
    } else {
        var pkg = require('./package.json');
        currentPackage = pkg.name.concat(pkg.version, '.tar.gz');
    }
    return currentPackage;
}

function shouldUpdate(currentPackage, updateInfo) {
    updateInfo.update = updateInfo.packageName != undefined && currentPackage != updateInfo.packageName;
}

function performUpdate(updateInfo) {
    var settings = fsUtil.readSettings();
    var updateEnabled = settings['update'];
    if (updateEnabled == undefined) updateEnabled = true;
    if (updateEnabled) {
        console.log('Performing update', updateInfo.packageName);
        var update = require('./update');
        update.download(updateInfo.packageName, updateInfo.url,
        function(result) {
            if (result.success) {
                console.log('update extracted to', result.installPath);
                update.install(result.installPath);
            } else {
                console.log('update download failed');
            }
        });
    } else {
        console.log('Skipping update', updateInfo.packageName, 'Updates Disabled');
    }
}

serverSocket.on('update hub', function (message) {
    var currentPackage = getCurrentPackage();
    shouldUpdate(currentPackage, message);
    console.log('Update command', message);
    if (message.update) {
        performUpdate(message);
    }
});

serverSocket.on('hub command', function(message) {
    var command = message.command;
    var update = require('./update');
    switch(command) {
        case 'restart':
            update.restartService();
            break;
        case 'reboot':
            update.rebootSystem();
            break;
        case 'shutdown':
            update.shutdownSystem();
            break;
    }
});

var bluetoothManager = require('./lib/bluetoothManager');
var bluetoothLoaded = false;

function loadBluetooth() {
    if (bluetoothLoaded) return;
    bluetoothLoaded = true;

    var bm = bluetoothManager(serverSocket);
}

var pluginManager = require('./lib/pluginManager');
var pluginsLoaded = false;

function loadPlugins() {
    if (pluginsLoaded) return;
    pluginsLoaded = true;

    var pm = pluginManager(serverSocket);
    
    var plugins = [
       { name: 'hue', require: './plugins/PhilipsHuePlugin' }
       ,{ name: 'zwave', require: './plugins/ZwavePlugin'}
       ,{ name: 'lifx', require: './plugins/LifxPlugin' }
       ,{ name: 'sonos', require: './plugins/SonosPlugin' }
       ,{ name: 'wemo', require: './plugins/WemoPlugin'}
    ];
    var timeout = 0;
    
    for (var plugin of plugins)
        plugin.Lib = require(plugin.require);
        
    for (var plugin of plugins) {        
        setTimeout(p => {
            console.log(`load ${p.name}`);
            pm.loadPlugin(p.name, new p.Lib());
        }, timeout, plugin);
        timeout += 500;
    }
}