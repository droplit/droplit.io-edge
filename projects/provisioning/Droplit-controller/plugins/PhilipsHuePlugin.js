'use strict';

const async = require('async');
const hue = require('hue.js');
const util = require('util');

const droplitPlugin = require('./DroplitPlugin');
const droplitConstants = require('./DroplitConstants');

function PhilipsHuePlugin () {
    var self = this;
    PhilipsHuePlugin.super_.call(this);
    
    const appName = 'droplit-hub';
    const STEP_SIZE = 10;
    const TEMP_LOWER = 2000;
    const TEMP_UPPER = 6500;    
    
    let batchChange = false;
    let discoverer = new hue.discoverer();
    
    self.stations = new Map();
    
    setInterval(() => {
        // Ensure value update request does not interfere with batch change values
        if (batchChange)
            return;
        if (self.stations.size === 0)
            return;
        for (let station of self.stations.values())
            if (station._isInstalled)
                station.updateLights();
    }, 1000 * 10);
    
    this.connect = function (connectInfo) {
        self.log('Philips hue connecting...');
        self.discover();
    }
    this.deleteDevice = function (identifier, address) {
        // If address looks like an IP address, it's a bridge; otherwise light
        let matches = /\d{1,3}[.]\d{1,3}[.]\d{1,3}[.]\d{1,3}/.exec(address);
        if (matches)
            self.stations.delete(identifier);
        else {
            let id = parseIdentifier(identifier);
            let station = self.stations.get(address);
            if (station)
                station._lights.delete(id);
        }
    }
    this.discover = function () {
        discoverer.discover((stations) => {
            for (let stationData of stations) {
                let identifier = stationData.info.device.serialNumber;
                let station = self.stations.get(identifier);
                if (station === undefined) {
                    station = new Station(stationData);
                    self.stations.set(identifier, station);
                    station.emitDiscovered(this.deviceDiscovered);
                }
                station.discoverLights();
            }
        });
    }
    this.register = function (identifier, address) {
        let station = self.stations.get(identifier);
        if (station)
            station.register();
    }
    this.setServiceProperties = function (properties) {
        batchChange = true;       
        let bridges = new Map();
        // Combine states for each property where possible
        for (let property of properties) {
            let bridge = bridges.get(property.address) || {};
            let id = parseIdentifier(property.identifier);
            if (!bridge.hasOwnProperty(id)) {
                bridge[id] = {};
                bridge[id].address = property.address;
                bridge[id].identifier = id;
                bridge[id].state = {};
                bridge[id].properties = [];
            }
            if (property.serviceName === 'BinarySwitch' && property.propertyName === 'switch') {
                if (property.value === 'off' || property.value === 'on')
                    bridge[id].state.on = property.value === 'on' ? true : false;
            }
            else if (property.serviceName === 'MulticolorLight' && property.propertyName === 'brightness')
                bridge[id].state.bri = normalize(property.value, 0, 0xffff, 254);    
            else if (property.serviceName === 'MulticolorLight' && property.propertyName === 'hue')
                bridge[id].state.hue = +property.value;
            else if (property.serviceName === 'MulticolorLight' && property.propertyName === 'saturation')
                bridge[id].state.sat = normalize(property.value, 0, 0xffff, 254);
            else
                bridge[id].properties.push(property);
            bridges.set(property.address, bridge);
        }       
        for (let bridge of bridges.values()) {
            for (let id of Object.keys(bridge)) {
                // Set properties not handled by setState
                if (bridge[id].properties.length > 0)
                    for (let property of bridge[id].properties)
                        self.setServiceProperty(property.identifier, property.address, property.serviceName, property.propertyName, property.value);
                // Set combined state
                if (Object.keys(bridge[id].state).length > 0) {
                    let station = self.stations.get(bridge[id].address);
                    if (station) {
                        let light = station._lights.get(bridge[id].identifier);
                        if (light)
                            light.setState(bridge[id].state);
                    } 
                }
            }
        }
        batchChange = false;
    }
    
    function getLight(identifier, address) {
        let station = self.stations.get(address);
        if (station) {
            let id = parseIdentifier(identifier);
            return station._lights.get(id);
        }
        return null;
    }
    function microReciprocal(value) {
        return parseInt((1000000 / value).toString());
    }
    function normalize(value, min, max, mult) {
        mult = mult || 100;
        return Math.round(((value - min) / (max - min)) * mult);
    }
    function parseIdentifier(identifier) {
        return identifier.split('-')[1];
    }
    function retry(fn, options) {
        let defaults = { retries: 3, wait: 1000 };
        options = [defaults, options].reduce(Object.assign, {});
        
        let retryIntl = (attempts) => {
            fn()
                .then(() => { })
                .catch(() => {
                    if (attempts < options.retries)
                        setTimeout(() => {
                            retryIntl(attempts + 1);
                        }, options.wait);
                })
            }
        retryIntl(1);
    }
    
    // Binary Switch implementation
    self.get_switch = function (identifier, address, cb) {
        let light = getLight(identifier, address);
        if (light)
            light.getSwitch(cb);
    }
    self.set_switch = function (identifier, address, value) {
        let light = getLight(identifier, address);
        if (light)
            light.setSwitch(value);
    }
    self.switchOff = function (identifier, address) {
        let light = getLight(identifier, address);
        if (light)
            light.switchOff();
    }
    self.switchOn = function (identifier, address) {
        let light = getLight(identifier, address);
        if (light)
            light.switchOn();
    }
    
    // DimmableSwitch implementation
    self.get_ds_brightness = function (identifier, address, cb) {
        let light = getLight(identifier, address);
        if (light)
            light.getDSBrightness(cb);
    }
    self.set_ds_brightness = function (identifier, address, value) {
        let light = getLight(identifier, address);
        if (light)
            light.setDSBrightness(value);
    }
    self.stepDown = function (identifier, address) {
        let light = getLight(identifier, address);
        if (light)
            light.stepDown();
    }
    self.stepUp = function (identifier, address) {
        let light = getLight(identifier, address);
        if (light)
            light.stepUp();
    }
    
    // MulticolorLight implementation
    self.get_hue = function (identifier, address, cb) {
        let light = getLight(identifier, address);
        if (light)
            light.getHue(cb);
    }
    self.get_mcl_brightness = function (identifier, address, cb) {
        let light = getLight(identifier, address);
        if (light)
            light.getMclBrightness(cb);
    }
    self.get_saturation = function (identifier, address, cb) {
        let light = getLight(identifier, address);
        if (light)
            light.getSaturation(cb);
    }
    self.get_temperature = function (identifier, address, cb) {
        let light = getLight(identifier, address);
        if (light)
            light.getTemperature(cb);
    }
    self.get_tempLowerLimit = function (identifier, address, cb) {
        cb(TEMP_LOWER);
    }
    self.get_tempUpperLimit = function (identifier, address, cb) {
        cb(TEMP_UPPER);
    }
    self.set_hue = function (identifier, address, value) {
        let light = getLight(identifier, address);
        if (light)
            light.setHue(value);
    }
    self.set_mcl_brightness = function (identifier, address, value) {
        let light = getLight(identifier, address);
        if (light)
            light.setMclBrightness(value);
    }
    self.set_saturation = function (identifier, address, value) {
        let light = getLight(identifier, address);
        if (light)
            light.setSaturation(value);
    }
    self.set_temperature = function (identifier, address, value) {
        let light = getLight(identifier, address);
        if (light)
            light.setTemperature(value);
    }
    
    self.services = {
        BasicAuthBridge: {
            register: self.register
        },
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
    
    class Light {
        constructor (id, station, data) {
            this._id = id;
            this._manufacturer = data.manufacturername;
            this._modelId = data.modelid
            this._name = data.name;
            this._type = data.type;
            this._state = data.state;
            this._station = station;
        }
        
        get externalId () {
            return `${this._station._identifier}-${this._id}`;
        }
        
        get outputState () {
            return {
                ct: microReciprocal(this._state.ct),
                ds_brightness: normalize(this._state.bri, 0, 254),
                hue: this._state.hue,
                mcl_brightness: normalize(this._state.bri, 0, 254, 0xffff),
                on: !this._state.reachable ? 'off' :
                    this._state.on ? 'on' : 'off',
                sat: normalize(this._state.sat, 0, 254, 0xffff)
            }
        }
        
        get services () {
            switch (this._type) {
                case 'Extended color light':
                case 'Color light':
                    return ['BinarySwitch', 'DimmableSwitch', 'MulticolorLight'];
                case 'Dimmable light':
                case 'Dimmable plug-in unit':
                    return ['BinarySwitch', 'DimmableSwitch'];
                default:
                    return ['BinarySwitch'];
            }
        }
        
        getLightState () {
            return function (cb) {
                this._station._client.light(this._id, (err, data) => {
                    this._state = data.state;
                    cb();
                });
            }.bind(this);
        }
        
        outputProperties () {
            var state = this.outputState;
            if (state.on)
                self.servicePropertyChanged(this.externalId, 'BinarySwitch', 'switch', state.on);
            if (state.ds_brightness)
                self.servicePropertyChanged(this.externalId, 'DimmableSwitch', 'brightness', state.ds_brightness);
            if (state.mcl_brightness)
                self.servicePropertyChanged(this.externalId, 'MulticolorLight', 'brightness', state.mcl_brightness);
            if (state.hue)
                self.servicePropertyChanged(this.externalId, 'MulticolorLight', 'hue', state.hue);
            if (state.sat)
                self.servicePropertyChanged(this.externalId, 'MulticolorLight', 'sat', state.sat);
            if (state.ct) {
                self.servicePropertyChanged(this.externalId, 'MulticolorLight', 'temperature', state.ct);
                self.servicePropertyChanged(this.externalId, 'MulticolorLight', 'tempLowerLimit', TEMP_LOWER);
                self.servicePropertyChanged(this.externalId, 'MulticolorLight', 'tempUpperLimit', TEMP_UPPER);
            }
        }
        
        setState (state) {
            this._station._client.state(this._id, state, (err, res) => {
                if (!res)
                    return;
                for (let response of res)
                    if (response.success)
                        for (let id of Object.keys(response.success)) {
                            let matches = /\/lights\/(\d+)\/state\/(\w+)/.exec(id);
                            let prop = matches[2];
                            this._state[prop] = response.success[id];
                            let state = this.outputState;
                            
                            if (prop === 'on' && state.hasOwnProperty('on'))
                                self.servicePropertyChanged(this.externalId, 'BinarySwitch', 'switch', state.on);
                            if (prop === 'bri') {
                                if (state.hasOwnProperty('ds_brightness'))
                                    self.servicePropertyChanged(this.externalId, 'DimmableSwitch', 'brightness', state.ds_brightness);
                                if (state.hasOwnProperty('mcl_brightness'))
                                    self.servicePropertyChanged(this.externalId, 'MulticolorLight', 'brightness', state.mcl_brightness);
                            }
                            if (prop === 'hue' && state.hasOwnProperty('hue'))
                                self.servicePropertyChanged(this.externalId, 'MulticolorLight', 'hue', state.hue);
                            if (prop === 'sat' && state.hasOwnProperty('sat'))
                                self.servicePropertyChanged(this.externalId, 'MulticolorLight', 'saturation', state.sat);
                        } 
            });
        }
        
        update (state) {
            let oldState = this.outputState;
            this._state = state;
            let newState = this.outputState;
            if (newState.hasOwnProperty('on') && (newState.on != oldState.on))
                self.servicePropertyChanged(this.externalId, 'BinarySwitch', 'switch', newState.on);
            if (newState.hasOwnProperty('ds_brightness') && (newState.ds_brightness != oldState.ds_brightness))
                self.servicePropertyChanged(this.externalId, 'DimmableSwitch', 'brightness', newState.ds_brightness);
            if (newState.hasOwnProperty('mcl_brightness') && (newState.mcl_brightness != oldState.mcl_brightness))
                self.servicePropertyChanged(this.externalId, 'MulticolorLight', 'brightness', newState.mcl_brightness);
            if (newState.hasOwnProperty('hue') && (newState.hue != oldState.hue))
                self.servicePropertyChanged(this.externalId, 'MulticolorLight', 'hue', newState.hue);
            if (newState.hasOwnProperty('sat') && newState.sat && (newState.sat != oldState.sat))
                self.servicePropertyChanged(this.externalId, 'MulticolorLight', 'saturation', newState.sat);
            if (newState.hasOwnProperty('ct') && newState.ct && (newState.ct != oldState.ct))
                self.servicePropertyChanged(this.externalId, 'MulticolorLight', 'temperature', newState.ct);
        }
        
        // BinarySwitch Implementation
        getSwitch (cb) {
            this.getLightState()(() => {
                let state = this.outputState;
                cb(state.on);
            });
        }
        setSwitch (value) {
            switch (value) {
                case 'off':
                    this.switchOff();
                    break;
                case 'on':
                    this.switchOn();
                    break;
            }
        }
        switchOn () {
            this._station._client.on(this._id, (err, res) => {
                if (res) {
                    for (let key in res[0].success) {
                        var on = res[0].success[key];
                        this._state.on = on;
                        let state = this.outputState;
                        if (state.hasOwnProperty('on'))
                            self.servicePropertyChanged(this.externalId, 'BinarySwitch', 'switch', state.on);
                    }
                }
            });
        }
        switchOff () {
            this._station._client.off(this._id, (err, res) => {
                if (res) {
                    for (let key in res[0].success) {
                        var on = res[0].success[key];
                        this._state.on = on;
                        let state = this.outputState;
                        if (state.hasOwnProperty('on'))
                            self.servicePropertyChanged(this.externalId, 'BinarySwitch', 'switch', state.on);
                    }
                }
            });
        }
        
        // DimmableSwitch implementation
        getDSBrightness (cb) {
            this.getLightState()(() => {
                let state = this.outputState;
                cb(state.ds_brightness);
            });
        }
        setDSBrightness (value) {
            let brightness = Math.min(Math.max(normalize(value, 0, 99, 255), 0), 255);
            this._station._client.state(this._id, { bri: brightness }, (err, res) => {
                if (res) {
                    for (let key in res[0].success) {
                        let bri = res[0].success[key];
                        this._state.bri = bri;
                        let state = this.outputState;
                        if (state.hasOwnProperty('ds_brightness'))
                            self.servicePropertyChanged(this.externalId, 'DimmableSwitch', 'brightness', state.ds_brightness);
                        if (state.hasOwnProperty('mcl_brightness'))
                            self.servicePropertyChanged(this.externalId, 'MulticolorLight', 'brightness', state.mcl_brightness);
                    }
                }
            });
        }
        stepDown () {
            this.getDSBrightness((value) => {
                this.setDSBrightness(Math.max(value - STEP_SIZE, 0));
            });
        }
        stepUp () {
            this.getDSBrightness((value) => {
                this.setDSBrightness(Math.min(value + STEP_SIZE, 99));
            });
        }
        
        // MulticolorLight implementation
        getHue (cb) {
            this.getLightState()(() => {
                let state = this.outputState;
                cb(state.hue);
            });
        }
        getMclBrightness (cb) {
            this.getLightState()(() => {
                let state = this.outputState;
                cb(state.mcl_brightness);
            });
        }
        getSaturation (cb) {
            this.getLightState()(() => {
                let state = this.outputState;
                cb(state.sat);
            });
        }
        getTemperature (cb) {
            this.getLightState()(() => {
                let state = this.outputState;
                cb(state.ct);
            });
        }
        setHue (value) {
            this._station._client.state(this._id, { hue: +value }, (err, res) => {
                if (res) {
                    for (let key in res[0].success) {
                        let hue = res[0].success[key];
                        this._state.hue = hue;
                        let state = this.outputState;
                        if (state.hasOwnProperty('hue'))
                            self.servicePropertyChanged(this.externalId, 'MulticolorLight', 'hue', state.hue);
                    }
                }
            });
        }
        setMclBrightness (value) {
            let brightness = Math.min(Math.max(normalize(value, 0, 0xffff, 254), 0), 254);
            this._station._client.state(this._id, { bri: brightness }, (err, res) => {
                if (res) {
                    for (let key in res[0].success) {
                        let bri = res[0].success[key];
                        this._state.bri = bri;
                        let state = this.outputState;
                        if (state.hasOwnProperty('ds_brightness'))
                            self.servicePropertyChanged(this.externalId, 'DimmableSwitch', 'brightness', state.ds_brightness);
                        if (state.hasOwnProperty('mcl_brightness'))
                            self.servicePropertyChanged(this.externalId, 'MulticolorLight', 'brightness', state.mcl_brightness);
                    }
                }
            });
        }
        setSaturation (value) {
            let saturation = Math.min(Math.max(normalize(value, 0, 0xffff, 254), 0), 254);
            this._station._client.state(this._id, { sat: saturation }, (err, res) => {
                if (res) {
                    for (let key in res[0].success) {
                        let sat = res[0].success[key];
                        this._state.sat = sat;
                        let state = this.outputState;
                        if (state.hasOwnProperty('sat'))
                            self.servicePropertyChanged(this.externalId, 'MulticolorLight', 'saturation', state.sat);
                    }
                }
            });
        }
        setTemperature (value) {
            let tempurature = microReciprocal(value);
            this._station._client.state(this._id, { ct: tempurature }, (err, res) => {
                if (res) {
                    for (let key in res[0].success) {
                        let ct = res[0].success[key];
                        this._state.ct = ct;
                        let state = this.outputState;
                        if (state.hasOwnProperty('ct'))
                            self.servicePropertyChanged(this.externalId, 'MulticolorLight', 'tempurature', state.ct);
                    }
                }
            });
        }
    }
    
    class Station {
        constructor (config) {
            this._address = config.address;
            this._client = hue.createClient({
                appName: appName,
                stationIp: this._address
            });
            this._identifier = config.info.device.serialNumber;
            this._isInstalled = false;
            this._lights = new Map();
            this._manufacturer = config.info.device.manufacturer;
            this._modelDescription = config.info.device.modelDescription; 
            this._productName = config.info.device.modelName;
            this._productType = config.info.device.friendlyName;
        }
        
        get identifier() {
            return this._identifier;
        }
        
        discoverLights () {
            retry(() => {
                return new Promise ((res, rej) => {
                    this._client.lights((err, lights) => {
                        // Call failed due to bad connection
                        if (err && err.code === 'ECONNRESET')
                            return rej(err);
                            
                        // Unauthorized user - need to register bridge
                        if (err && err.type === 1) {
                            console.log('App not registered on bridge', err);
                            try {
                                this._client.register(err => {
                                    if (err)
                                        console.log('register failed: ', err);
                                    else
                                        self.servicePropertyChanged(this._identifier, 'BasicAuthBridge', 'authenticated', true);
                                });
                            } catch (ex) {
                                self.log('could not register app on bridge', ex);
                            }
                            return res();
                        }
                        
                        // Unknown error - I don't know how to handle something like that
                        if (err) {
                            console.error('Unknown error', err);
                            return res();
                        }

                        // Bridge is already installed
                        if (!this._isInstalled) {
                            this._isInstalled = true;
                            self.deviceDiscovered({
                                identifier: this._identifier,
                                isInstalled: true
                            });
                        }
                            
                        // Only get state for new lights - filter out old ones
                        for (let id of this._lights.keys())
                            if (lights.hasOwnProperty(id))
                                delete lights[id];
                                    
                        for (let id in lights) {
                            if (!this._lights.get(id)) {
                                let light = new Light(id, this, lights[id]);
                                this._lights.set(id, light);
                                var deviceData = {
                                    address: this._identifier,
                                    identifier: light.externalId,
                                    oldIdentifier: id, // Not stored in db, used to resolve old format
                                    manufacturer: this._manufacturer,
                                    productName: this._modelDescription,
                                    productType: this._productType,
                                    name: light._name,
                                    promotedMembers: {
                                        'switch': 'BinarySwitch.switch',
                                        'brightness': 'DimmableSwitch.brightness'
                                    },
                                    services: light.services
                                }
                                self.deviceDiscovered(deviceData);
                            }
                        }
                        // Ensure light props set up after device discovered
                        for (let id in lights) {
                            let light = this._lights.get(id);
                            if (light)
                                setTimeout(() => {
                                    light.outputProperties();
                                }, 500);
                        }
                        
                        return res();
                    });
                });
            }, { retries: 5, wait: 1000});
        }
        
        emitDiscovered () {
            let stationData = {
                address: this._address,
                identifier: this._identifier,
                manufacturer: this._manufacturer,
                productName: this._productName,
                productType: this._productType,
                services: ['BasicAuthBridge'],
                promotedMembers: {
                    'register': 'BasicAuthBridge.register'
                },
                bridge: {
                    appName: appName,
                    type: 'hue'
                }
            };
            self.deviceDiscovered(stationData);
        }
        
        register () {
            this._client.lights((err, lights) => {
                // Call failed due to bad connection
                if (err && err.code === 'ECONNRESET')
                    return;
                    
                // Unauthorized user - need to register bridge
                if (err && err.type === 1) {
                    console.log('App not registered on bridge', err);
                    // TODO: Register bridge
                    try {
                        this._client.register(err => {
                            if (err)
                                console.log('register failed: ', err);
                            else {
                                self.servicePropertyChanged(this._identifier, 'BasicAuthBridge', 'authenticated', true);
                                setTimeout(() => { this.register() }, 0);
                            }
                        });
                    } catch (ex) {
                        self.log('could not register app on bridge', ex);
                    }
                    return;
                }
                
                // Bridge is already installed
                if (!this._isInstalled) {
                    this._isInstalled = true;
                    self.deviceDiscovered({
                        identifier: this._identifier,
                        isInstalled: true
                    });
                }
                
                // Only get state for new lights - filter out old ones
                for (let id of this._lights.keys())
                    if (lights.hasOwnProperty(id))
                        delete lights[id];
                                    
                for (let id in lights) {
                    if (!this._lights.get(id)) {
                        let light = new Light(id, this, lights[id]);
                        this._lights.set(id, light);
                        var deviceData = {
                            address: this._identifier,
                            identifier: light.externalId,
                            oldIdentifier: id, // Not stored in db, used to resolve old format
                            manufacturer: this._manufacturer,
                            productName: this._modelDescription,
                            productType: this._productType,
                            name: light._name,
                            promotedMembers: {
                                'switch': 'BinarySwitch.switch',
                                'brightness': 'DimmableSwitch.brightness'
                            },
                            services: light.services
                        }
                        self.deviceDiscovered(deviceData);
                    }
                }
                
                // Ensure light props set up after device discovered
                for (let id in lights) {
                    let light = this._lights.get(id);
                    if (light)
                        setTimeout(() => {
                            light.outputProperties();
                        }, 500);
                }
            });
        }
        
        updateLights () {
            this._client.lights((err, lights) => {
                // Call failed due to bad connection
                if (err && err.code === 'ECONNRESET')
                    return;
                
                for (let id in lights) {
                    let light = this._lights.get(id);
                    if (light)
                        light.update(lights[id].state);
                }
            });
        }
    }
}

util.inherits(PhilipsHuePlugin, droplitPlugin);
module.exports = PhilipsHuePlugin;