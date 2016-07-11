/**
 * Created by Bryan on 6/18/2014.
 */
var util = require('util');
var path = require('path');

var droplitPlugin = require('./DroplitPlugin');
var droplitConstants = require('./DroplitConstants');

var zwavePlugin = function() {
    var _this = this;
    zwavePlugin.super_.call(this);

    var OZW;
    // this should stop it from crashing if the zwave library is missing
    try {
        OZW = require('openzwave-shared');
        console.log('zwave load');
    } catch (ex) {
        console.log('zwave failed');
        return;
    }
    var zwave = new OZW({
        //modpath: path.resolve(path.join(__dirname, 'zwave_options.xml')),
        SaveConfiguration: false,   // write an XML network layout
        Logging: false,             // enable logging to OZW_Log.txt
        ConsoleOutput: false,       // copy logging to the console
        SuppressValueRefresh: true, // do not send updates if nothing changed
        PollInterval: 750,          // interval between polls in milliseconds
        IntervalBetweenPolls: false // poll at absolute time intervals (insted of time between poll and response)
    });

    var isConnected = false;
    var discoveredDevices = [];
    var deviceTypes = {};
    
    // supported node types
    var RADIO = 0;
    var BINARY_SWITCH = 1;
    var DIMMABLE_SWITCH = 2;

    this.connect = function(connectInfo) {
        zwave.connect('/dev/ttyUSB0');
    }

    this.disconnect = function() {
        if (isConnected) {
            isConnected = false;
            _this.logInfo('Zwave disconnecting...');
            zwave.disconnect();
        }
    }

    // BEGIN: Z-Wave events

    zwave.on('connected', function(){
        _this.log('connected args', arguments);
        isConnected = true;
        _this.connected(droplitConstants.ConnectResult.SUCCESS);
    });

    zwave.on('driver ready', function(homeid){
        _this.log('driver ready. home id: ' + homeid);
    });

    zwave.on('driver failed', function(){
        zwave.disconnect();
        _this.log('driver failed. args: ', arguments);
    });

    zwave.on('node ready', function(nodeid, nodeinfo){
        // this just contains the network address
        _this.log('node added: ', nodeinfo);
    });
    
    zwave.on('node added', function(nodeid, commandclass, value){
        // this just contains the network address
        _this.log('node added: ' + nodeid);
    });

    var nodesAlreadyReady = {};

    zwave.on('node ready', function(nodeid, nodeinfo) {
        if (nodesAlreadyReady[nodeid]) return; // exit if this node was already discovered this session
        nodesAlreadyReady[nodeid] = true;
        _this.log('node ready. nodeid: ' + nodeid + ' node info:' + JSON.stringify(nodeinfo));
        if (discoveredDevices.indexOf(nodeid) >= 0) {
            // device already discovered
            return;
        }
        discoveredDevices.push(nodeid);
        var suppressDevice = false;
        var services = [];
        var promotedMembers;
        switch (nodeinfo.producttype) {
            case "0002":
                // Z-Stick S2
                suppressDevice = true;
                deviceTypes[nodeid] = RADIO;
                break;
            case "0003": // Smart Energy Switch
                services.push("BinarySwitch");
                promotedMembers = {
                    "switch": "BinarySwitch.switch",
                    "switchOn": "BinarySwitch.switchOn",
                    "switchOff": "BinarySwitch.switchOff"
                }
                deviceTypes[nodeid] = BINARY_SWITCH;
                break;
            case "0004": case "5257": // Binary Power Switch
                services.push("BinarySwitch");
                promotedMembers = {
                    "switch": "BinarySwitch.switch",
                    "switchOn": "BinarySwitch.switchOn",
                    "switchOff": "BinarySwitch.switchOff"
                }
                deviceTypes[nodeid] = BINARY_SWITCH;
                break;
            case "4457": // Multilevel Power Switch
                services.push("BinarySwitch");
                services.push("DimmableSwitch");
                promotedMembers = {
                    "switch": "BinarySwitch.switch",
                    "switchOn": "BinarySwitch.switchOn",
                    "switchOff": "BinarySwitch.switchOff",
                    "brightness": "DimmableSwitch.brightness"
                }
                deviceTypes[nodeid] = DIMMABLE_SWITCH;
                // poll brightness
                zwave.enablePoll(nodeid, 38);
                break;
        }
        if (!suppressDevice) {
            _this.deviceDiscovered({
                identifier: nodeid,
                address: nodeid,
                productName: nodeinfo.product,
                productType: nodeinfo.type,
                manufacturer: nodeinfo.manufacturer,
                name: nodeinfo.name,
                location: nodeinfo.loc,
                services: services,
                promotedMembers: promotedMembers
            }, nodeinfo);
        }
    });

    //zwave.on('value added', valueChanged);

    zwave.on('value changed', valueChanged);

    var lastSwitchValue = {};
    var lastSwitchLevel = {};

    function valueChanged (nodeid, commandclass, value) {
        //_this.log('value changed: nodeid', nodeid, 'commandclass', commandclass, 'value', value);
        switch (commandclass) {
            case 37: // Switch
                var newValue = value.value ? "on" : "off";
                _this.servicePropertyChanged(nodeid, "BinarySwitch", "switch", newValue);
                break;
            case 38: // Level
                //if (!isRamping()) {
                if (lastSwitchLevel[nodeid] != value.value) {
                    _this.servicePropertyChanged(nodeid, "DimmableSwitch", "brightness", value.value);
                }
                    
                //}
                var switchValue = value.value > 0 ? 'on' : 'off';
                var changedEvent = false;
                if (lastSwitchValue[nodeid] == undefined) {
                    changedEvent = true;
                    lastSwitchValue[nodeid] = switchValue;
                } else {
                    changedEvent = lastSwitchValue[nodeid] == switchValue ? false : true;
                    lastSwitchValue[nodeid] = switchValue;
                }
                if (changedEvent) {
                    _this.servicePropertyChanged(nodeid, "BinarySwitch", "switch", switchValue);
                }
                // if it's going down, cancel ramp up
                //if (lastSwitchLevel[nodeid] > value.value) cancelRamp(nodeid);
                // store last value
                lastSwitchLevel[nodeid] = value.value;
                break;
        }
    }

    // END: Z-Wave events

    // special functions

    _this.command = function(message) {
        switch (message) {
            case "hard reset":
                zwave.hardReset();
                break;
            case "soft reset":
                zwave.softReset();
                break;
        }
    }

    // BinarySwitch service implementation

    _this.BinarySwitch_switchOn = function (identifier, address) {
        if (!isConnected) return;
        // ramp up
        //ramp(identifier, 99);
        
        // new way
        switch (deviceTypes[identifier]) {
            case BINARY_SWITCH:
                zwave.setValue(identifier, 37, 1, 0, true);
                break;
            case DIMMABLE_SWITCH:
                //zwave.setValue(identifier, 38, 1, 0, 99);
                var value = onSwitchLevel[identifier];
                if (value == undefined) {
                    value = 99;
                }
                zwave.setValue(identifier, 38, 1, 0, value);
                break;
        }
    }

    var destValues = {};
    var timerHandle = null;
    var rampStep = 4;

    function ramp(identifier, value) {
        destValues[identifier] = value;
        var lastValue = lastSwitchLevel[identifier];
        if (lastValue < value) {
            if (lastValue + rampStep < value) {
                zwave.setLevel(identifier, lastValue + rampStep);
            } else {
                zwave.setLevel(identifier, value);
            }
        } else {
            if (lastValue - rampStep > value) {
                zwave.setLevel(identifier, lastValue - rampStep);
            } else {
                zwave.setLevel(identifier, value);
            }
        }
        startRamp();
    }

    function startRamp() {
        if (timerHandle == null) {
            timerHandle = setInterval(rampFunction, 100);
        }
    }

    function stopRamp() {
        clearInterval(timerHandle);
        timerHandle = null;
    }

    function isRamping() {
        return (timerHandle != null);
    }

    function rampFunction() {
        var keys = Object.keys(destValues);
        keys.forEach(function(identifier) {
            var lastValue = lastSwitchLevel[identifier];
            var nextValue = destValues[identifier];
            if (lastValue < nextValue) {
                if (lastValue + rampStep < nextValue) {
                    nextValue = lastValue + rampStep;
                    zwave.setLevel(identifier, nextValue);
                } else {
                    _this.servicePropertyChanged(identifier, "DimmableSwitch", "brightness", nextValue);
                    delete destValues[identifier];
                    zwave.setLevel(identifier, nextValue);
                }
            } else if (lastValue > nextValue) {
                if (lastValue - rampStep > nextValue) {
                    nextValue = lastValue - rampStep;
                    zwave.setLevel(identifier, nextValue);
                } else {
                    _this.servicePropertyChanged(identifier, "DimmableSwitch", "brightness", nextValue);
                    delete destValues[identifier];
                    zwave.setLevel(identifier, nextValue);
                }
            } else {
                delete destValues[identifier];
            }
        });
        if (Object.keys(destValues).length == 0) stopRamp();
    }

    function cancelRamp(nodeid) {
        delete destValues[nodeid];
    }

    var onSwitchLevel = {}; // the brightness of the light when last turned off
    
    _this.BinarySwitch_switchOff = function (identifier, address) {
        if (!isConnected) return;
        
        // new way
        switch (deviceTypes[identifier]) {
            case BINARY_SWITCH:
                zwave.setValue(identifier, 37, 1, 0, false);
                break;
            case DIMMABLE_SWITCH:
                onSwitchLevel[identifier] = lastSwitchLevel[identifier];
                zwave.setValue(identifier, 38, 1, 0, 0);
                break;
        }
    }

    _this.BinarySwitch_set_switch = function (identifier, address, value) {
        switch (value) {
            case "on":
                _this.BinarySwitch_switchOn(identifier);
                break;
            case "off":
                _this.BinarySwitch_switchOff(identifier);
                break;
        }
    }

    _this.BinarySwitch_get_switch = function (identifier, address, callback) {
        _this.log('get switch not supported');
        return false;
    }

    var binarySwitch = {
        switchOn : _this.BinarySwitch_switchOn,
        switchOff : _this.BinarySwitch_switchOff,
        set_switch : _this.BinarySwitch_set_switch,
        get_switch : _this.BinarySwitch_get_switch
    }

    // DimmableSwitch Service Implementation

    _this.DimmableSwitch_get_brightness = function (identifier, address, callback) {
        return false;
    }

    _this.DimmableSwitch_set_brightness = function (identifier, address, value) {
        if (!isConnected) return;
        if (value >= 100) value = 99;
        if (value < 0) value = 0;
        //ramp(identifier, value);
        
        switch (deviceTypes[identifier]) {
            case BINARY_SWITCH:
                // nop
                break;
            case DIMMABLE_SWITCH:
                zwave.setValue(identifier, 38, 1, 0, value);
                break;
        }
    }

    var dimmableSwitch = {
        get_brightness : _this.DimmableSwitch_get_brightness,
        set_brightness : _this.DimmableSwitch_set_brightness
    }

    // setup all services

    _this.services = {
        BinarySwitch : binarySwitch,
        DimmableSwitch : dimmableSwitch
    }

}

util.inherits(zwavePlugin, droplitPlugin);
module.exports = zwavePlugin;