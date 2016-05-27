'use strict';

const crypto = require('crypto');
const Discoverer = require('./Discoverer');
const droplit = require('droplit-plugin');
const EventEmitter = require('events').EventEmitter;
const request = require('request');

const StepSize = 10;
const TempLower = 2000;
const TempUpper = 6500;

class HuePlugin extends droplit.DroplitPlugin {
    constructor() {
        super();
        
        this.bridges = new Map();
        
        this.discoverer = new Discoverer();
        this.discoverer.on('discovered', onDiscovered.bind(this));
        this.discoverer.on('ipchange', onDiscoverIPChange.bind(this));
        
        this.services = {
            BinarySwitch: {
                // get_switch: this.getSwitch,
                // set_switch: this.setSwitch,
                // switchOff: this.switchOff,
                // switchOn: this.switchOn
            },
            DimmableSwitch: {
                // get_brightness: this.getDSBrightness,
                // set_brightness: this.setDSBrightness,
                // stepDown: this.stepDown,
                // stepUp: this.stepUp
            },
            MulticolorLight: {
                // get_brightness: this.getMclBrightness,
                // get_hue: this.getHue,
                // get_saturation: this.getSaturation,
                // get_temperature: this.getTemperature,
                // get_tempLowerLimit: this.getTempLowerLimit,
                // get_tempUpperLimit: this.getTempUpperLimit,
                // set_brightness: this.setMclBrightness,
                // set_hue: this.setHue,
                // set_saturation: this.setSaturation,
                // set_temperature: this.setTemperature
            }
        }
        
        function onDiscovered(data) {
            let identifier = data.identifier;
            let bridge = this.bridges.get(identifier);
            if (bridge === undefined) {
                bridge = new Bridge(data);
                bridge.on('discovered', onLightDiscovered.bind(this));
                
                this.bridges.set(identifier, bridge);
                this.onDeviceInfo(bridge.discoverObject());
            }
        }
        
        function onDiscoverIPChange(data) { }
        
        function onLightDiscovered(light) {
            this.onDeviceInfo(light.discoverObject());
        }
    }
    
    discover() {
        this.discoverer.discover();
    }
    
    dropDevice(localId) { }
    
    // BinarySwitch Implementation
    getSwitch(localId, callback) { }
    
    setSwitch(localId, value) { }
    
    switchOff(localId) { }
    
    switchOn(localId) { }
        
    // DimmableSwitch Implementation
    getDSBrightness(localId, callback) { }
    
    setDSBrightness(localId, value) { }
    
    stepDown(localId) { }
    
    stepUp(localId) { }
    
    // MulticolorLight Implementation
    getMclBrightness(localId, callback) { }
    
    getHue(localId, callback) { }
    
    getSaturation(localId, callback) { }
    
    getTemperature(localId, callback) { }
    
    getTempLowerLimit(localId, callback) { }
    
    getTempUpperLimit(localId, callback) { }
    
    setHue(localId, value) { }
    
    setMclBrightness(localId, value) { }
    
    setSaturation(localId, value) { }
    
    setTemperature(localId, value) { }
    
}

const AppName = 'droplit-hub';

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
            
            // New devices
            Object.keys(b).forEach(id => {
                let lightData = b[id];
                let identifier = Light.formatId(lightData.uniqueid);
                if (!this.lights.has(identifier)) {
                    this.lights.set(identifier, new Light(lightData, id));
                    this.emit('discovered', this.lights.get(identifier));
                    return;
                }
                
                // TODO: Handle changes
                
                // let light = this.lights.get(identifier);
                // // Correct the path id if changed
                // if (light.pathId !== id)
                //     light.pathId = id;
            });
            
            if (callback)
                callback(e, b);
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
}

module.exports = HuePlugin;