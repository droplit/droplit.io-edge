'use strict';

const crypto = require('crypto');
const Discoverer = require('./Discoverer');
const droplit = require('droplit-plugin');
const EventEmitter = require('events').EventEmitter;
const request = require('request');

const PollInterval = 1000 * 10; // in ms
const StepSize = 10;
const TempLower = 2000; // in Kelvins
const TempUpper = 6500; // in Kelvins

class HuePlugin extends droplit.DroplitPlugin {
    constructor() {
        super();
        
        this.bridges = new Map();
        
        this.discoverer = new Discoverer();
        this.discoverer.on('discovered', onDiscovered.bind(this));
        this.discoverer.on('ipchange', onDiscoverIPChange.bind(this));
        
        this._getBridgeByLight = function (identifier) {
            for (let bridge of this.bridges.values()) {
                if (!bridge.isInstalled)
                    continue;
                if (bridge.lights.has(identifier))
                    return bridge;
            }
            return null;
        }
        
        this.services = {
            BasicAuthBridge: {
                register: this.register
            },
            BinarySwitch: {
                get_switch: this.getSwitch,
                set_switch: this.setSwitch,
                switchOff: this.switchOff,
                switchOn: this.switchOn
            },
            DimmableSwitch: {
                get_brightness: this.getDSBrightness,
                set_brightness: this.setDSBrightness,
                stepDown: this.stepDown,
                stepUp: this.stepUp
            },
            MulticolorLight: {
                get_brightness: this.getMclBrightness,
                get_hue: this.getHue,
                get_saturation: this.getSaturation,
                get_temperature: this.getTemperature,
                get_tempLowerLimit: this.getTempLowerLimit,
                get_tempUpperLimit: this.getTempUpperLimit,
                set_brightness: this.setMclBrightness,
                set_hue: this.setHue,
                set_saturation: this.setSaturation,
                set_temperature: this.setTemperature
            }
        }
     
        // TODO: Off/on with connect/disconnect
        setInterval(() => {
            if (this.bridges.size === 0)
                return;
                
            for (let bridge of this.bridges.values())
                bridge.getLights();
        }, PollInterval);
        
        function onBridgeInstalled(bridge) {
            this.onDeviceInfo({ localId: bridge.identifier, isInstalled: true });
        }
        
        function onDiscovered(data) {
            let identifier = data.identifier;
            let bridge = this.bridges.get(identifier);
            if (bridge === undefined) {
                bridge = new Bridge(data);
                bridge.on('discovered', onLightDiscovered.bind(this));
                bridge.on('installed', onBridgeInstalled.bind(this));
                bridge.on('state-changes', onStateChanges.bind(this));
                
                this.bridges.set(identifier, bridge);
                this.onDeviceInfo(bridge.discoverObject());
            }
        }
        
        function onDiscoverIPChange(data) {
            let identifier = data.identifier;
            let address = data.ip.host;
            let bridge = this.bridges.get(identifier);
            if (!bridge)
                return;
            bridge.address = address;
            this.onDeviceInfo({ address, identifier });
        }
        
        function onLightDiscovered(light) {
            this.onDeviceInfo(light.discoverObject());
        }
        
        function onStateChanges(data) {
            let output = data.light.outputState;
            let changes = data.changes.reduce((p, c) => {
                if (data.light.services.some(s => s === 'BinarySwitch') && (c.state === 'on'))
                    p.push(data.light.propertyObject('BinarySwitch', 'switch', output.on));
                    
                if (data.light.services.some(s => s === 'DimmableSwitch') && (c.state === 'bri'))
                    p.push(data.light.propertyObject('DimmableSwitch', 'brightness', output.ds_brightness));
                    
                if (data.light.services.some(s => s === 'MulticolorLight')) {
                    if (c.state === 'bri')
                        p.push(data.light.propertyObject('MulticolorLight', 'brightness', output.mcl_brightness));
                    if (c.state === 'hue')
                        p.push(data.light.propertyObject('MulticolorLight', 'hue', output.hue));
                    if (c.state === 'sat')
                        p.push(data.light.propertyObject('MulticolorLight', 'saturation', output.sat));
                    if (c.state === 'ct')
                        p.push(data.light.propertyObject('MulticolorLight', 'temperature', output.ct));
                    if (c.state === 'temp_low')
                        p.push(data.light.propertyObject('MulticolorLight', 'tempLowerLimit', c.value));
                    if (c.state === 'temp_high')
                        p.push(data.light.propertyObject('MulticolorLight', 'tempUpperLimit', c.value));    
                }
                    
                return p;
            }, []);
            
            if (changes.length > 0)
                this.onPropertiesChanged(changes);
        }
    }
    
    discover() {
        this.discoverer.discover();
    }
    
    dropDevice(localId) { }
    
    getState(localId, state, callback) {
        let bridge = this._getBridgeByLight(localId);
        if (!bridge)
            return callback();
            
        bridge.getLightState(localId, (err, success) => {
            if (err)
                return callback();
            
            let output = Bridge.outputState(success);
            callback(output[state]);
        });
    }
    
    // BasicAuthBridge Implementation
    register(localId) {
        let bridge = this.bridges.get(localId);
        if (!bridge)
            return;
        bridge.register();
    }
    
    // BinarySwitch Implementation
    getSwitch(localId, callback) {
        this.getState(localId, 'on', callback);
    }
    
    setSwitch(localId, value) {
        if (value === 'off')
            this.switchOff(localId);
        else if (value === 'on')
            this.switchOn(localId);
    }
    
    switchOff(localId) {
        let bridge = this._getBridgeByLight(localId);
        if (!bridge)
            return;
            
        bridge.setState(localId, { on: false });
    }
    
    switchOn(localId) {
        let bridge = this._getBridgeByLight(localId);
        if (!bridge)
            return;
            
        bridge.setState(localId, { on: true });
    }
        
    // DimmableSwitch Implementation
    getDSBrightness(localId, callback) {
        this.getState(localId, 'ds_brightness', callback);
    }
    
    setDSBrightness(localId, value) {
        let bridge = this._getBridgeByLight(localId);
        if (!bridge)
            return;
            
        let brightness = Math.min(Math.max(normalize(value, 0, 99, 255), 0), 255);
        bridge.setState(localId, { bri: brightness });
    }
    
    stepDown(localId) {
        this.getDSBrightness(localId, value => {
            if (value === undefined)
                return;
            this.setDSBrightness(localId, Math.max(value - StepSize, 0));
        });
    }
    
    stepUp(localId) {
        this.getDSBrightness(localId, value => {
            if (value === undefined)
                return;
            this.setDSBrightness(localId, Math.min(value + StepSize, 99));
        });
    }
    
    // MulticolorLight Implementation
    getMclBrightness(localId, callback) {
        this.getState(localId, 'mcl_brightness', callback);
    }
    
    getHue(localId, callback) {
        this.getState(localId, 'hue', callback);
    }
    
    getSaturation(localId, callback) {
        this.getState(localId, 'sat', callback);
    }
    
    getTemperature(localId, callback) {
        this.getState(localId, 'ct', callback);
    }
    
    getTempLowerLimit(localId, callback) {
        let bridge = this._getBridgeByLight(localId);
        if (!bridge)
            return callback();
            
        callback(TempLower);
    }
    
    getTempUpperLimit(localId, callback) {
        let bridge = this._getBridgeByLight(localId);
        if (!bridge)
            return callback();
            
        callback(TempUpper);
    }
    
    setHue(localId, value) {
        let bridge = this._getBridgeByLight(localId);
        if (!bridge)
            return;
            
        bridge.setState(localId, { hue: +value });
    }
    
    setMclBrightness(localId, value) {
        let bridge = this._getBridgeByLight(localId);
        if (!bridge)
            return;
            
        let brightness = Math.min(Math.max(normalize(value, 0, 0xffff, 254), 0), 254);
        bridge.setState(localId, { bri: brightness });
    }
    
    setSaturation(localId, value) {
        let bridge = this._getBridgeByLight(localId);
        if (!bridge)
            return;
            
        let saturation = Math.min(Math.max(normalize(value, 0, 0xffff, 254), 0), 254);
        bridge.setState(localId, { sat: saturation });
    }
    
    setTemperature(localId, value) {
        let bridge = this._getBridgeByLight(localId);
        if (!bridge)
            return;
            
        let temperature = microReciprocal(value);
        bridge.setState(localId, { ct: temperature });
    }
    
}

const AppName = 'droplit#edge';

class Bridge extends EventEmitter {
    constructor(config) {
        super();
        
        this.address = config.location.host;
        this.bridge = {
            appName: AppName,
            type: 'hue'
        };
        this.key = crypto.createHash('md5').update(AppName).digest('hex');
        this.identifier = config.identifier;
        this.isInstalled = false;
        this.product = {
            friendlyName: config.info.device.friendlyName,
            manufacturer: config.info.device.manufacturer,
            modelDescription: config.info.device.modelDescription,
            modelName: config.info.device.modelName,
            modelNumber: config.info.device.modelNumber,
        };
        this.promotedMembers = {
            register: 'BasicAuthBridge.register'
        };
        this.services = [ 'BasicAuthBridge' ];
        
        this.lights = new Map();
        
        this.getLights();
    }
    
    static outputState(state) {
        return {
            ct: microReciprocal(state.ct),
            ds_brightness: normalize(state.bri, 0, 254),
            hue: state.hue,
            mcl_brightness: normalize(state.bri, 0, 254, 0xffff),
            on: !state.reachable ? 'off' :
                state.on ? 'on' : 'off',
            sat: normalize(state.sat, 0, 254, 0xffff)
        };
    }
    
    discoverObject() {
        return {
            localId: this.identifier,
            address: this.address,
            product: this.product,
            deviceMeta: { name: this.product.friendlyName },
            services: this.services,
            promotedMembers: this.promotedMembers
        };
    }
    
    getLightState(identifier, callback) {
        let light = this.lights.get(identifier);
        if (!light)
            return;
        
        let opts = {
            json: true,
            method: 'GET',
            timeout: 3000,
            url: `http://${this.address}/api/${this.key}/lights/${light.pathId}`
        };
        request(opts, (e, r, b) => {
            if (e) {
                if (callback)
                    callback(e);
                return;
            }
            
            callback(null, b.state);
        });
    }
    
    getLights(callback) {
        let opts = {
            json: true,
            timeout: 3000,
            url: `http://${this.address}/api/${this.key}/lights`
        };
        request(opts, (e, r, b) => {
            if (e) {
                if (callback)
                    callback(e);
                return;
            }
            
            // See if response is an error
            if (Array.isArray(b) && b[0].hasOwnProperty('error')) {
                // App is not registered
                if (b[0].error.type === 1)
                    setImmediate(() => this.register.bind(this)());
                return;
            }
            
            if (!this.isInstalled) {
                this.isInstalled = true;
                this.emit('installed', this);
            }
            
            let deviceChanges = [];
            // New devices
            Object.keys(b).forEach(id => {
                let lightData = b[id];
                let identifier = Light.formatId(lightData.uniqueid);
                if (!this.lights.has(identifier)) {
                    let light = new Light(lightData, id);
                    this.lights.set(identifier, light);
                    this.emit('discovered', light);
                    deviceChanges.push({ light, changes: light.stateAsChanges() });
                    return;
                }

                let light = this.lights.get(identifier);
                let changes = [];
                [ 'on', 'bri', 'hue', 'sat', 'ct' ].forEach(state => {
                    if (lightData.state[state] !== light.state[state])
                        changes.push({ state, value: lightData.state[state] });
                });
                if (changes.length > 0)
                    deviceChanges.push({ light, changes });
                    
                light.state = lightData.state;
                
                // TODO: May need to handle id changes
            });
            
            if (deviceChanges.length > 0)
                deviceChanges.forEach(dc =>
                    this.emit('state-changes', { light: dc.light, changes: dc.changes }));
            
            if (callback)
                callback(e, b);
        });
    }
    
    register(callback) {
        let opts = {
            json: {
                devicetype: AppName,
                username: this.key
            },
            method: 'POST',
            timeout: 3000,
            url: `http://${this.address}/api`
        };
        request(opts, (e, r, b) => {
            if (e) {
                if (callback)
                    callback(e);
                return;
            }
            
            if (b[0].hasOwnProperty('error')) {
                // Link button not pressed
                if (b[0].error.type === 101) {
                    // TODO: Notify to press button
                    // console.log('User not authorized, press link button');
                }
                return;
            }
            
            setImmediate(() => this.getLights.bind(this));
        });
    }
    
    setState(identifier, state, callback) {
        let light = this.lights.get(identifier);
        if (!light)
            return;
            
        let opts = {
            json: state,
            method: 'PUT',
            timeout: 3000,
            url: `http://${this.address}/api/${this.key}/lights/${light.pathId}/state`
        };
        request(opts, (e, r, b) => {
            if (e) {
                if (callback)
                    callback(e);
                return;
            }
            
            let errors = [];
            let success = {};
            let changes = [];
            
            b.forEach(response => {
                if (response.error) {
                    errors.push(response.error);
                    return;
                }
                
                let stateRegex = new RegExp(`\/lights\/${light.pathId}\/state\/(.+)`);
                Object.keys(response.success).forEach(key => {
                    let stateName = stateRegex.exec(key)[1];
                    success[stateName] = response.success[key];
                    if (light.state[stateName] !== response.success[key]) {
                        changes.push({ state: stateName, value: response.success[key] });
                        light.state[stateName] = response.success[key];
                    }
                });
            });
            
            if (changes.length > 0)
                this.emit('state-changes', { light, changes });
            
            if (callback)
                callback(errors, success);
        });
    }
}

class Light {
    constructor(config, pathId) {
        this.pathId = pathId;
        this.uniqueid = Light.formatId(config.uniqueid),
        this.name = config.name,
        this.type = config.type,
        this.modelid = config.modelid,
        this.manufacturername = config.manufacturername.trim(),
        this.state = config.state            
    }
    
    static formatId(id) {
        return id.replace(/[:-]/g, '');
    }
    
    get outputState() {
        return Bridge.outputState(this.state);
    }
    
    get promotedMembers() {
        let members = {};
        if (this.services.some(s => s === 'BinarySwitch'))
            members['switch'] = 'BinarySwitch.switch';
        if (this.services.some(s => s === 'DimmableSwitch'))
            members['brightness'] = 'DimmableSwitch.brightness';
        return members;
    }
    
    get services() {
        switch (this.type) {
            case 'Extended color light':
            case 'Color light':
                return [ 'BinarySwitch', 'DimmableSwitch', 'MulticolorLight' ];
            case 'Dimmable light':
            case 'Dimmable plug-in unit':
                return [ 'BinarySwitch', 'DimmableSwitch' ];
            default:
                return [ 'BinarySwitch' ];
        }
    }
    
    discoverObject() {
        return {
            localId: this.uniqueid,
            address: this.pathId,
            product: {
                friendlyName: this.name,
                manufacturer: this.manufacturername,
                modelName: this.type,
                modelNumber: this.modelid                
            },
            deviceMeta: { name: this.name },
            services: this.services,
            promotedMembers: this.promotedMembers
        }
    }
    
    stateAsChanges() {
        let props = [];
        if (this.state.hasOwnProperty('on'))
            props.push({ state: 'on', value: this.state.on });
        if (this.state.hasOwnProperty('bri'))
            props.push({ state: 'bri', value: this.state.bri });
        if (this.state.hasOwnProperty('hue'))
            props.push({ state: 'hue', value: this.state.hue });
        if (this.state.hasOwnProperty('sat'))
            props.push({ state: 'sat', value: this.state.sat });
        if (this.state.hasOwnProperty('ct')) {
            props.push({ state: 'ct', value: this.state.ct });
            props.push({ state: 'temp_low', value: TempLower });
            props.push({ state: 'temp_high', value: TempUpper });
        }
            
        return props;
    }
    
    propertyObject(service, member, value) {
        return {
            localId: this.uniqueid,
            service,
            member,
            value
        };
    }
}

function microReciprocal(value) {
    return parseInt((1000000 / value).toString());
}

function normalize(value, min, max, mult) {
    mult = mult || 100;
    return Math.round(((value - min) / (max - min)) * mult);
}

module.exports = HuePlugin;