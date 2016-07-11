/**
* Created by Nik! on 6/30/2014.
*/

'use strict';

var async = require('async');
var util = require('util');

var droplitPlugin = require('./DroplitPlugin');
var droplitConstants = require('./DroplitConstants');

var lifxPlugin = function () {
    var self = this;
    lifxPlugin.super_.call(this);

    var lifx = require('lifx');
    var bulbs = {};
    var lx = null;
    var pendingGets = {
        ds_brightness: [],
        hue: [],
        mcl_brightness: [],
        power: [],
        saturation: [],
        temperature: []
    };
    var STEP_SIZE = parseInt(0xFFFF / 10);
    var TEMP_LOWER = 2500;
    var TEMP_UPPER = 9000;
    var batchChange = false;
    self.intervalID = null;

    this.connect = function (connectInfo) {
        self.log('lifx connecting...');
        lx = lifx.init();
        lx.on('bulb', onBulb);
        lx.on('bulbstate', onBulbState);
        lx.on('gateway', onGateway);
        lx.on('powerState', onPowerState);
        lx.on('version', onVersion);
    }

    // Lifx events
    function onBulb(data) {
        var address = data.addr.toString('hex');
        if (!bulbs[address]) {
            bulbs[address] = {};
            bulbs[address].bulb = { addr: data.addr };
            bulbs[address].name = data.name;
        }
        if (!bulbs[address].hasOwnProperty('state')) {
            bulbs[address].state = data.state;
            if (bulbs[address].hasOwnProperty('version')) {
                bulbs[address].isReady = true;
                sendDiscovered(bulbs[address]);
            }
        }
    }
    function onBulbState(data) {
        var address = data.addr.toString('hex');
        if (!bulbs[address]) {
            bulbs[address] = {};
            bulbs[address].bulb = { addr: data.addr };
            bulbs[address].name = data.name;
        }
        if (!bulbs[address].hasOwnProperty('state')) {
            bulbs[address].state = data.state;
            if (bulbs[address].hasOwnProperty('version')) {
                bulbs[address].isReady = true;
                sendDiscovered(bulbs[address]);
            }
        }
        if (bulbs[address].isReady) {
            var changes = {};

            // Brightness
            if (!bulbs[address].state.hasOwnProperty('brightness') || bulbs[address].state.brightness !== data.state.brightness) {
                bulbs[address].state.brightness = data.state.brightness;
                changes.brightness = true;
            }
            // Hue
            if (!bulbs[address].state.hasOwnProperty('hue') || bulbs[address].state.hue !== data.state.hue) {
                bulbs[address].state.hue = data.state.hue;
                changes.hue = true;
            }
            // Kelvin
            if (!bulbs[address].state.hasOwnProperty('kelvin') || bulbs[address].state.kelvin !== data.state.kelvin) {
                bulbs[address].state.kelvin = data.state.kelvin;
                changes.kelvin = true;
            }
            // Power
            if (!bulbs[address].state.hasOwnProperty('power') || bulbs[address].state.power !== data.state.power) {
                bulbs[address].state.power = data.state.power;
                changes.power = true;
            }
            // Saturation
            if (!bulbs[address].state.hasOwnProperty('saturation') || bulbs[address].state.saturation !== data.state.saturation) {
                bulbs[address].state.saturation = data.state.saturation;
                changes.saturation = true;
            }
            // Temperature Limits
            if (!bulbs[address].state.tempLowerLimit) {
                bulbs[address].state.tempLowerLimit = TEMP_LOWER;
                changes.tempLowerLimit = true;
            }
            if (!bulbs[address].state.tempUpperLimit) {
                bulbs[address].state.tempUpperLimit = TEMP_UPPER;
                changes.tempUpperLimit = true;
            }

            var state = getOutputState(address);
            processPendingGets('ds_brightness', address, state.ds_brightness);
            processPendingGets('hue', address, state.hue);
            processPendingGets('mcl_brightness', address, state.mcl_brightness);
            processPendingGets('saturation', address, state.sat);
            processPendingGets('temperature', address, state.temp);

            // Only report change if different
            if (changes.power)
                self.servicePropertyChanged(address, 'BinarySwitch', 'switch', state.on);
            if (changes.brightness) {
                self.servicePropertyChanged(address, 'DimmableSwitch', 'brightness', state.ds_brightness);
                self.servicePropertyChanged(address, 'MulticolorLight', 'brightness', state.mcl_brightness);
            }
            if (changes.hue)
                self.servicePropertyChanged(address, 'MulticolorLight', 'hue', state.hue);
            if (changes.saturation)
                self.servicePropertyChanged(address, 'MulticolorLight', 'saturation', state.sat);
            if (changes.kelvin)
                self.servicePropertyChanged(address, 'MulticolorLight', 'temperature', state.temp);
            if (changes.tempLowerLimit)
                self.servicePropertyChanged(address, 'MulticolorLight', 'tempLowerLimit', state.tempLowerLimit);
            if (changes.tempUpperLimit)
                self.servicePropertyChanged(address, 'MulticolorLight', 'tempUpperLimit', state.tempUpperLimit);
        }
        clearInterval(self.intervalID);
        self.intervalID = setInterval(function () {
            if (!batchChange)
                lx.requestStatus();
        }, 1000 * 10);
    }
    function onGateway(data) {
        var bulb = { addr: new Buffer(data.bulbAddress, 'hex') };
        lx.sendToOne(lifx.packet.getVersion({ protocol: 0x1400 }), bulb);
    }
    function onPowerState(data) {
        var address = data.addr.toString('hex');
        var value = data.state.onoff == 0xFFFF ? 'on' : 'off';
        processPendingGets('power', address, value);
        bulbs[address].state.power = data.state;
    }
    function onVersion(data) {
        var address = data.addr.toString('hex');
        if (!bulbs[address]) {
            bulbs[address] = {};
            bulbs[address].bulb = { addr: data.addr };
        }
        if (!bulbs[address].hasOwnProperty('version')) {
            bulbs[address].version = data.version;
            if (bulbs[address].hasOwnProperty('state')) {
                bulbs[address].isReady = true;
                sendDiscovered(bulbs[address]);
            }
        }
    }

    function getOutputState(address) {
        return {
            ds_brightness: normalize(bulbs[address].state.brightness, 0, 0xffff),
            hue: bulbs[address].state.hue,
            mcl_brightness: bulbs[address].state.brightness,
            on: bulbs[address].state.power > 0 ? 'on' : 'off',
            sat: bulbs[address].state.saturation,
            temp: bulbs[address].state.kelvin,
            tempLowerLimit: bulbs[address].state.tempLowerLimit,
            tempUpperLimit: bulbs[address].state.tempUpperLimit
        }
    }
    function sendDiscovered(device) {
        var address = device.bulb.addr.toString('hex');
        var services;
        var product = '';
        // Lifx White
        if (device.version.product == 167772160) {
            product = 'LIFX White';
            services = ['BinarySwitch', 'DimmableSwitch'];
        }
        // Lifx Original
        else {
            // TODO: get version for LIFX Color to give different product name
            product = 'LIFX';
            services = ['BinarySwitch', 'DimmableSwitch', 'MulticolorLight'];
        }

        self.deviceDiscovered({
            address: address,
            identifier: address,
            manufacturer: 'LIFX Labs',
            productName: product,
            productType: product,
            name: device.name,
            services: services,
            promotedMembers: {
                'switch': 'BinarySwitch.switch',
                'brightness': 'DimmableSwitch.brightness'
            }
        });
        var state = getOutputState(address);
        self.servicePropertyChanged(address, 'BinarySwitch', 'switch', state.on);
        self.servicePropertyChanged(address, 'DimmableSwitch', 'brightness', state.ds_brightness);
        if (services.indexOf('MulticolorLight') > -1) {
            self.servicePropertyChanged(address, 'MulticolorLight', 'brightness', state.mcl_brightness);
            self.servicePropertyChanged(address, 'MulticolorLight', 'hue', state.hue);
            self.servicePropertyChanged(address, 'MulticolorLight', 'saturation', state.sat);
            self.servicePropertyChanged(address, 'MulticolorLight', 'temperature', state.temp);
            self.servicePropertyChanged(address, 'MulticolorLight', 'tempLowerLimit', state.tempLowerLimit);
            self.servicePropertyChanged(address, 'MulticolorLight', 'tempUpperLimit', state.tempUpperLimit);
        }

    }
    function normalize(value, min, max, mult) {
        mult = mult || 100;
        return parseInt(((value - min) / (max - min)) * mult);
    }
    function processPendingGets(type, address, value) {
        if (pendingGets[type].length > 0) {
            var idx = pendingGets[type].length - 1;
            do {
                var get = pendingGets[type][idx];
                if (get.address == address) {
                    get.callback(value);
                    pendingGets[type].splice(idx, 1);
                }
            }
            while (idx--);
        }
    }
    function setColor(identifier, address, properties) {
        if (validateLight(identifier, address)) {
            var state = bulbs[address].state;
            if (properties.hue)
                state.hue = properties.hue;
            if (properties.saturation)
                state.saturation = properties.saturation;
            if (properties.brightness)
                state.brightness = properties.brightness;
            if (properties.kelvin)
                state.kelvin = properties.kelvin;
            lx.lightsColour(state.hue, state.saturation, state.brightness, state.kelvin, 0, bulbs[address].bulb);
            setTimeout(function () { lx.requestStatus(); }, 650);
        }
    }
    function validateLight(identifier, address) {
        if (!lx) {
            lx = lifx.init();
            return false;
        }
        if (!bulbs[address] || !bulbs[address].hasOwnProperty('bulb')) {
            if (!batchChange)
                lx.requestStatus(); // Attempt to get missing bulb information
            return false;
        }
        return true;
    }

    self.deleteDevice = function (identifier, address) {
        if (bulbs[address])
            delete bulbs[address];
    }
    self.discover = function () {
        // Attempt to find new gateway
        lx.discover();
        // Look for bulbs on existing gateway
        lx.requestStatus();
    }
    self.setServiceProperties = function (properties) {
        batchChange = true;
        try {
            var devices = {};
            properties.forEach(function (property) {
                if (!devices.hasOwnProperty(property.address)) {
                    devices[property.address] = {};
                    devices[property.address].address = property.address;
                    devices[property.address].identifier = property.identifier;
                    devices[property.address].properties = [];
                }
                if (property.serviceName == 'MulticolorLight' && property.propertyName == 'hue')
                    devices[property.address].hue = property;
                else if (property.serviceName == 'MulticolorLight' && property.propertyName == 'saturation')
                    devices[property.address].saturation = property;
                else if (property.serviceName == 'MulticolorLight' && property.propertyName == 'brightness')
                    devices[property.address].brightness = property;
                else
                    devices[property.address].properties.push(property);
            });
            for (var i in devices) {
                var device = devices[i];
                device.properties.forEach(function (property) {
                    self.setServiceProperty(property.identifier, property.address, property.serviceName, property.propertyName, property.value);
                });
                var colorProperties = {};
                if (device.hue)
                    colorProperties.hue = device.hue.value;
                if (device.saturation)
                    colorProperties.saturation = device.saturation.value;
                if (device.brightness)
                    colorProperties.brightness = device.brightness.value;
                // Only set colors if there are colors to set
                if (Object.keys(colorProperties).length > 0)
                    setColor(device.identifier, device.address, colorProperties);
            }
        } catch (ex) {
            self.log('error: ', ex.ToString());
        }
        finally {
            batchChange = false;
        }
    }

    // Binary Switch implementation
    self.get_switch = function (identifier, address, cb) {
        if (validateLight(identifier, address)) {
            var bulb = bulbs[address].bulb;
            pendingGets.power.push({ address: address, callback: cb });
            lx.sendToOne(lifx.packet.getPowerState(), bulb);
        }
    }
    self.set_switch = function (identifier, address, value) {
        switch (value) {
            case 'off':
                self.switchOff(identifier, address);
                break;
            case 'on':
                self.switchOn(identifier, address);
                break;
        }
    }
    self.switchOff = function (identifier, address) {
        if (validateLight(identifier, address)) {
            var bulb = bulbs[address].bulb;
            lx.lightsOff(bulb);
            self.servicePropertyChanged(address, 'BinarySwitch', 'switch', 'off');
        }
    }
    self.switchOn = function (identifier, address) {
        if (validateLight(identifier, address)) {
            var bulb = bulbs[address].bulb;
            lx.lightsOn(bulb);
            self.servicePropertyChanged(address, 'BinarySwitch', 'switch', 'on');
        }
    }

    // DimmableSwitch implementation
    self.get_ds_brightness = function (identifier, address, cb) {
        if (validateLight(identifier, address)) {
            var bulb = bulbs[address].bulb;
            pendingGets.ds_brightness.push({ address: address, callback: cb });
            lx.requestStatus();
        }
    }
    self.set_ds_brightness = function (identifier, address, value) {
        if (validateLight(identifier, address)) {
            var state = bulbs[address].state;
            var brightness = normalize(value, 0, 99, 0xFFFF);
            lx.lightsColour(state.hue, state.saturation, brightness, state.kelvin, 0, bulbs[address].bulb);
            setTimeout(function () {
                lx.requestStatus();
            }, 500)
        }
    }
    self.stepDown = function (identifier, address) {
        if (validateLight(identifier, address)) {
            var brightness = normalize(Math.max(bulbs[address].state.brightness - STEP_SIZE, 0), 0, 0xFFFF, 99);
            self.set_ds_brightness(identifier, address, brightness);
        }
    }
    self.stepUp = function (identifier, address, value) {
        if (validateLight(identifier, address)) {
            var brightness = normalize(Math.min(bulbs[address].state.brightness + STEP_SIZE, 0xFFFF), 0, 0xFFFF, 99);
            self.set_ds_brightness(identifier, address, brightness);
        }
    }

    // MulticolorLight implementation
    self.get_hue = function (identifier, address, cb) {
        if (validateLight(identifier, address)) {
            var bulb = bulbs[address].bulb;
            pendingGets.hue.push({ address: address, callback: cb });
            lx.requestStatus();
        }
    }
    self.get_mcl_brightness = function (identifier, address, cb) {
        if (validateLight(identifier, address)) {
            var bulb = bulbs[address].bulb;
            pendingGets.mcl_brightness.push({ address: address, callback: cb });
            lx.requestStatus();
        }
    }
    self.get_saturation = function (identifier, address, cb) {
        if (validateLight(identifier, address)) {
            var bulb = bulbs[address].bulb;
            pendingGets.saturation.push({ address: address, callback: cb });
            lx.requestStatus();
        }
    }
    self.get_temperature = function (identifier, address, cb) {
        if (validateLight(identifier, address)) {
            var bulb = bulbs[address].bulb;
            pendingGets.temperature.push({ address: address, callback: cb });
            lx.requestStatus();
        }
    }
    self.get_tempLowerLimit = function (identifier, address, cb) {
        cb(TEMP_LOWER);
    }
    self.get_tempUpperLimit = function (identifier, address, cb) {
        cb(TEMP_UPPER);
    }
    self.set_hue = function (identifier, address, value) {
        if (validateLight(identifier, address)) {
            var state = bulbs[address].state;
            lx.lightsColour(value, state.saturation, state.brightness, state.kelvin, 0, bulbs[address].bulb);
            setTimeout(function () { lx.requestStatus(); }, 500);
        }
    }
    self.set_mcl_brightness = function (identifier, address, value) {
        if (validateLight(identifier, address)) {
            var state = bulbs[address].state;
            lx.lightsColour(state.hue, state.saturation, value, state.kelvin, 0, bulbs[address].bulb);
            setTimeout(function () { lx.requestStatus(); }, 500);
        }
    }
    self.set_saturation = function (identifier, address, value) {
        if (validateLight(identifier, address)) {
            var state = bulbs[address].state;
            lx.lightsColour(state.hue, value, state.brightness, state.kelvin, 0, bulbs[address].bulb);
            setTimeout(function () { lx.requestStatus(); }, 500);
        }
    }
    self.set_temperature = function (identifier, address, value) {
        if (validateLight(identifier, address)) {
            var state = bulbs[address].state;
            lx.lightsColour(state.hue, 0, state.brightness, value, 0, bulbs[address].bulb);
            setTimeout(function () { lx.requestStatus(); }, 500);
        }
    }

    self.services = {
        BinarySwitch: {
            get_switch: self.get_switch,
            set_switch: self.set_switch,
            switchOff: self.switchOff,
            switchOn: self.switchOn
        },
        DimmableSwitch: {
            get_brightness: self.get_ds_brightness,
            set_brightness: self.set_ds_brightness,
            stepDown: self.stepDown,
            stepUp: self.stepUp
        },
        MulticolorLight: {
            get_brightness: self.get_mcl_brightness,
            get_hue: self.get_hue,
            get_saturation: self.get_saturation,
            get_temperature: self.get_temperature,
            get_tempLowerLimit: self.get_tempLowerLimit,
            get_tempUpperLimit: self.get_tempUpperLimit,
            set_brightness: self.set_mcl_brightness,
            set_hue: self.set_hue,
            set_saturation: self.set_saturation,
            set_temperature: self.set_temperature
        }
    }
}

util.inherits(lifxPlugin, droplitPlugin);
module.exports = lifxPlugin;