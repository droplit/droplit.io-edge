/* global identifier */
/**
* Created by Nik! on 6/24/2014.
*/

'use strict';

var util = require('util');

var droplitPlugin = require('./DroplitPlugin');
var droplitConstants = require('./DroplitConstants');

var wemoPlugin = function () {
    var self = this;
    wemoPlugin.super_.call(this);

    var wemo = require('wemo.js');
    var discoverer = new wemo.discoverer();
    var coffeeMode = {
        0: 'notReady',
        1: 'placeCarafe',
        2: 'refillWater',
        3: 'ready',
        4: 'brewing',
        5: 'brewed',
        6: 'notReady',
        7: 'notReady',
        8: 'brewingCarafeRemoved'
    }

    var devices = [];

    this.connect = function (connectInfo) {
        self.log('wemo connecting...');
        self.discover();
    }
    
    discoverer.on('discovered', onDiscovered);
    discoverer.on('ipchange', onDiscoverIPChange);

    function onDiscovered (device) {
        if (!devices[device.identifier]) {
            var address = device.location.host;
            var client = wemo.createClient(address);
            var isCoffee = device.info.device.modelName === 'CoffeeMaker';
            if (isCoffee)
                client.on('mode', function (data) {
                    if (data.mode) {
                        var mode = !coffeeMode[data.mode] ? 'notReady' : coffeeMode[data.mode];
                        self.servicePropertyChanged(device.identifier, 'CoffeeMaker', 'state', mode);
                    }
                });
            else
                client.on('state', function (data) {
                    if (data.state) {
                        var state = parseInt(data.state) ? 'on' : 'off';
                        if (state != devices[device.identifier].state) {
                            devices[device.identifier].state = state;
                            self.servicePropertyChanged(device.identifier, "BinarySwitch", "switch", state);
                        }
                    }
                });
            devices[device.identifier] = { client: client, device: device };
            if (isCoffee) {
                self.deviceDiscovered({
                    address: address,
                    identifier: device.identifier,
                    manufacturer: device.info.device.manufacturer,
                    productName: 'Belkin WeMo ' + device.info.device.modelName,
                    productType: device.info.device.friendlyName,
                    services: ['CoffeeMaker'],
                    promotedMembers: { 'brew': 'CoffeeMaker.brew' }
                });
                self.get_state(device.identifier, address, function (state) {
                    self.servicePropertyChanged(device.identifier, 'CoffeeMaker', 'state', state);
                });
            }
            else {
                self.deviceDiscovered({
                    address: address,
                    identifier: device.identifier,
                    manufacturer: device.info.device.manufacturer,
                    productName: 'Belkin WeMo ' + device.info.device.modelName,
                    productType: device.info.device.friendlyName,
                    services: ['BinarySwitch'],
                    promotedMembers: {
                        'switch': 'BinarySwitch.switch',
                        'switchOn': 'BinarySwitch.switchOn',
                        'switchOff': 'BinarySwitch.switchOff'
                    }
                });
                self.get_switch(device.identifier, address, function (state) {
                    devices[device.identifier].state = state ? 'on' : 'off';
                    self.servicePropertyChanged(device.identifier, 'BinarySwitch', 'switch', state);
                });
            }
        }
    }
    
    function onDiscoverIPChange (data) {
        var identifier = data.identifier;
        var address = data.ip.host;
        var client = wemo.createClient(address);
        var isCoffee = devices[identifier].device.info.device.modelName === 'CoffeeMaker';
        if (isCoffee)
            client.on('mode', function (data) {
                if (data.mode) {
                    var mode = !coffeeMode[data.mode] ? 'notReady' : coffeeMode[data.mode];
                    self.servicePropertyChanged(identifier, 'CoffeeMaker', 'state', mode);
                }
            });
        else
            client.on('state', function (data) {
                if (data.state) {
                    var state = parseInt(data.state) ? 'on' : 'off';
                    if (state != devices[identifier].state) {
                        devices[identifier].state = state;
                        self.servicePropertyChanged(identifier, "BinarySwitch", "switch", state);
                    }
                }
            });
        // TODO: Unsubscribe upnp events
        // Clean up old client
        devices[identifier].client.removeAllListeners();
        delete devices[identifier].client;
        
        devices[identifier].client = client;
        devices[identifier].location = data.ip;
        
        self.deviceDiscovered({
            address: address,
            identifier: identifier
        });
    }

    self.discover = function () { discoverer.discover(); }

    self.deleteDevice = function (identifier, address) {
        if (devices[identifier])
            delete devices[identifier];
    }

    // Binary Switch implementation
    self.get_switch = function (identifier, address, cb) {
        var device = devices[identifier];
        if (device == null) {
            //TODO: Invalid identifier
            cb();
        }
        else {
            device.client.state(function (err, state) {
                if (err)
                    self.logError('Could not get Wemo state', err);
                cb(state ? 'on' : 'off');
            });
        }
    }
    self.set_switch = function (identifier, address, value) {
        switch (value) {
            case "off":
                self.switchOff(identifier, address);
                break;
            case "on":
                self.switchOn(identifier, address);
                break;
        }
    }
    self.switchOff = function (identifier, address) {
        var device = devices[identifier];
        if (device == null) {
            //TODO: Invalid identifier
            return;
        }
        device.client.switchOff();
    }
    self.switchOn = function (identifier, address) {
        var device = devices[identifier];
        if (device == null) {
            //TODO: Invalid identifier
            return;
        }
        device.client.switchOn();
    }

    // Coffee Maker implementation
    self.brew = function (identifier, address) {
        var device = devices[identifier];
        if (device == null) {
            //TODO: Invalid identifier
            return;
        }
        else
            device.client.brew(function (err, state) {
                if (err)
                    self.logError('Could not brew', err);
            });
    }
    self.get_state = function (identifier, address, cb) {
        var device = devices[identifier];
        if (device == null) {
            //TODO: Invalid identifier
            cb();
        } else {
            device.client.getAttributes(function (err, state) {
                if (err)
                    self.logError('Could not get Wemo state', err);
                if (!coffeeMode[state.value])
                    cb('notReady');
                else
                    cb(coffeeMode[state.value]);
            })
        }
    }

    self.services = {
        BinarySwitch: {
            get_switch: self.get_switch,
            set_switch: self.set_switch,
            switchOff: self.switchOff,
            switchOn: self.switchOn
        },
        CoffeeMaker: {
            brew: self.brew,
            get_state: self.get_state
        }
    }
}

util.inherits(wemoPlugin, droplitPlugin);
module.exports = wemoPlugin;