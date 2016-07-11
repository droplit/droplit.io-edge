/**
 * Created by Bryan on 6/19/2014.
 */

var util = require('util');
var async = require('async');
var debug = require('debug');

// load plugins
var plugins = {};

var serverSocket;

var lastPropValues = {};

var pluginManager = function(socket) {
    serverSocket = socket;
    
    // TODO: not sure why this fails
    //serverSocket.setMaxListeners(50); // allow for more than 10 event handlers

    // TODO: rename
    serverSocket.on('service method', function(message) {
        console.log('call method ' + JSON.stringify(message));
        callServiceMethod(message.pluginName, message.pluginIdentifier, message.address, message.serviceName, message.methodName, message.params);
    });

    serverSocket.on('call methods', function(message) {
        console.log('call methods ' + JSON.stringify(message));
        message.forEach(function(method) {
            callServiceMethod(method.pluginName, method.pluginIdentifier, method.address, method.serviceName, method.methodName, method.params);
        });
    });

    serverSocket.on('set property', function(message) {
        console.log('set property ' + JSON.stringify(message));
        setServiceProperty(message.pluginName, message.pluginIdentifier, message.address, message.serviceName, message.propertyName, message.value);
    });

    serverSocket.on('set properties', function(message) {
        //console.log('set properties ' + JSON.stringify(message, null, 3));
        var props = [];
        var lastPlugin = null;
        message.forEach(function(prop) {
            //setServiceProperty(prop.pluginName, prop.pluginIdentifier, prop.address, prop.serviceName, prop.propertyName, prop.value);
            prop.identifier = prop.pluginIdentifier;
            delete prop.pluginIdentifier;
            if (lastPlugin == prop.pluginName) {
                props.push(prop);
            } else {
                if (lastPlugin != null) {
                    setServiceProperties(lastPlugin, props);
                }
                // next plugin
                lastPlugin = prop.pluginName;
                props = [];
                props.push(prop);
            }
        });
        if (props.length > 1) {
            setServiceProperties(lastPlugin, props);
        } else if (props.length == 1) {
            setServiceProperty(props[0].pluginName, props[0].identifier, props[0].address, props[0].serviceName, props[0].propertyName, props[0].value);
        }
    });

    serverSocket.on('get property', function(message, ret) {
        console.log('get property ' + JSON.stringify(message));
        var result = getServiceProperty(message.pluginName, message.pluginIdentifier, message.address, message.serviceName, message.propertyName, function (response) {
            ret(response);
        });
    });

    serverSocket.on('device delete', function(message) {
        console.log('device delete ' + JSON.stringify(message));
        deletePluginDevice(message.pluginName, message.pluginIdentifier, message.address);
    });
    
    // special functions
    serverSocket.on('plugin command', function(message) {
        console.log('plugin command', JSON.stringify(message));
        pluginCommand(message.pluginName, message.message);
    });

    serverSocket.on('helo', function(message) {
        console.log('helo ' + JSON.stringify(message));
    });

    serverSocket.on('ehlo', function(message, ret) {
        console.log('ehlo ' + JSON.stringify(message));
        ret({status: 'online'});
    });
    
    serverSocket.on('auto discover', function(message) {
        if (message.enable == true) {
            console.log('enabling auto discover (%s seconds)', message.interval);
            enableAutoDiscovery(message.interval);
        } else {
            console.log('disabling auto discover');
            disableAutoDiscovery(message.interval);
        }
    });
    
    var autoDiscoverTimer = undefined;
    
    function enableAutoDiscovery(interval) {
        disableAutoDiscovery();
        autoDiscoverTimer = setInterval(discoverAllDevices, interval * 1000);
        discoverAllDevices();
    }
    
    function disableAutoDiscovery() {
        if (autoDiscoverTimer !== undefined) {
            clearInterval(autoDiscoverTimer);
            autoDiscoverTimer = undefined;
        }
    }
    
    function discoverAllDevices() {
        // discover all devices
        var pluginNames = Object.keys(plugins);
        var timeout = 0;
        for (var idx in pluginNames) {
            setTimeout(function(pluginName) {
                plugins[pluginName].discover();
            }.bind(this), timeout, pluginNames[idx]);
            timeout += 2000;
        }
    }
    
    // start auto-discovery
    setTimeout(function() {
        enableAutoDiscovery(60);
    }, 3 * 60 * 1000);

    this.loadPlugin = loadPlugin;

    return this;
}

function loadPlugin (name, plugin) {
    plugins[name] = plugin;
    var pluginDebug = debug('hub:' + name);
    plugin.log = pluginDebug.bind(pluginDebug);

    plugin.on('connected', function(responseCode, responseMessage) {
        clog(name, 'connected');
    });

    plugin.on('log info', function(args) {
        clog(name, args);
    });

    plugin.on('log error', function(args) {
        clog(name, args);
    });

    plugin.on('device discovered', function(deviceInfo, deviceMetaData) {
        // clog(name, util.format('device discovered \r\n\t identifier:%s \r\n\t address:%s \r\n\t productName:%s \r\n\t productType:%s \r\n\t manufacturer:%s \r\n\t name:%s \r\n\t location:%s \r\n\t services:%s \r\n\t promote:%s',
        //     deviceInfo.identifier,
        //     deviceInfo.address,
        //     deviceInfo.productName,
        //     deviceInfo.productType,
        //     deviceInfo.manufacturer,
        //     deviceInfo.name,
        //     deviceInfo.location,
        //     deviceInfo.services,
        //     deviceInfo.promotedMembers
        // ));
        plugin.log('device discovered \r\n\t identifier:%s \r\n\t address:%s \r\n\t productName:%s \r\n\t productType:%s \r\n\t manufacturer:%s \r\n\t name:%s \r\n\t location:%s \r\n\t services:%s \r\n\t promote:%s',
            deviceInfo.identifier,
            deviceInfo.address,
            deviceInfo.productName,
            deviceInfo.productType,
            deviceInfo.manufacturer,
            deviceInfo.name,
            deviceInfo.location,
            deviceInfo.services,
            deviceInfo.promotedMembers);
        serverSocket.emit('device discovered', {pluginName:name, deviceInfo: deviceInfo, deviceMetaData: deviceMetaData});
    });

    plugin.on('service property', function (identifier, serviceName, propertyName, value) {
        // clog(name, util.format('service property \r\n\t identifier:%s \r\n\t service name:%s \r\n\t property name:%s \r\n\t value:%s',
        //     identifier,
        //     serviceName,
        //     propertyName,
        //     value));
        plugin.log('service property \r\n\t identifier:%s \r\n\t service name:%s \r\n\t property name:%s \r\n\t value:%s',
            identifier,
            serviceName,
            propertyName,
            value);
        var valuePath = util.format('%s.%s.%s.%s', name, identifier, serviceName, propertyName);
        if (lastPropValues[valuePath] == value) {
            // do nothing
        } else {
            lastPropValues[valuePath] = value;
            serverSocket.emit('service property', {pluginName:name, pluginIdentifier: identifier, serviceName: serviceName, propertyName: propertyName, value: value});
        }
    });

    plugin.on('service event', function (identifier, serviceName, eventName, param) {
        serverSocket.emit('service event', {pluginName:name, pluginIdentifier: identifier, serviceName: serviceName, eventName: eventName, param: param});
    });

    clog(name, 'connecting');
    plugin.connect();
}

function callServiceMethod(pluginName, identifier, address, serviceName, methodName, params) {
    if (plugins[pluginName]) {
        return plugins[pluginName].callServiceMethod(identifier, address, serviceName, methodName, params);
    }
}

function getServiceProperty(pluginName, identifier, address, serviceName, propertyName, callback) {
    if (plugins[pluginName]) {
        return plugins[pluginName].getServiceProperty(identifier, address, serviceName, propertyName, callback);
    }
}

function setServiceProperty(pluginName, identifier, address, serviceName, propertyName, value) {
    if (plugins[pluginName]) {
        return plugins[pluginName].setServiceProperty(identifier, address, serviceName, propertyName, value);
    }
}

function setServiceProperties(pluginName, properties) {
    if (plugins[pluginName]) {
        return plugins[pluginName].setServiceProperties(properties);
    }
}

function deletePluginDevice(pluginName, identifier, address) {
    if (plugins[pluginName]) {
        plugins[pluginName].deleteDevice(identifier, address);
    }
}

function pluginCommand(pluginName, message) {
    if (plugins[pluginName]) {
        return plugins[pluginName].command(message);
    }
}

function clog(moduleName, args) {
    try {
        var message = null;
        if (args !== null && typeof args === 'object') {
            var params = [];
            Object.keys(args).forEach(function(key) { params.push(args[key]); });
            message = util.format.apply(util, params);
        } else {
            message = args;
        }
        //console.log(util.format('%s - plugin[%s]', new Date().toISOString(), moduleName)); //toDateString() //toISOString()
        console.log(util.format('%s - plugin[%s]: %s', new Date().toISOString(), moduleName, message)); //toDateString() //toISOString()
    } catch (err) {
        console.log(util.format('CLOG ERROR! plugin[%s]: %s %s', moduleName, err, JSON.stringify(args))); //toDateString() //toISOString()
    }
}

var disconnected = false;
process.on('SIGINT', function() {
    if(!disconnected) {
        disconnected = true;
        console.log('SIGINT');
        DisconnectPlugins();
    }
});

process.on('SIGHUP', function() {
    if (!disconnected) {
        disconnected = true;
        console.log('SIGHUP');
        DisconnectPlugins();
    }
});

process.on('exit', function() {
    if (!disconnected) {
        disconnected = true;
        console.log('exit');
        DisconnectPlugins();
    }
});

process.on('SIGTERM', exitProcess);
//process.on('SIGKILL', exitProcess); // in some combination this breaks it for some unknown reason
//process.on('SIGSTOP', exitProcess); // in some combination this breaks it for some unknown reason

function exitProcess() {
    if (!disconnected) {
        disconnected = true;
        console.log('terminate');
        DisconnectPlugins();
    }
};

function DisconnectPlugins() {
    for (var key in plugins) {
        var plugin = plugins[key];
        //console.log("disconnecting: " + JSON.stringify(plugin, null, 4));
        plugin.disconnect();
    }
    process.exit();
};

module.exports = pluginManager;