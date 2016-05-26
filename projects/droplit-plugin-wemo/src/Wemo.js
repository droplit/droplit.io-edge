'use strict';

const Discoverer = require('./Discoverer');
const Clients = require('./WemoClient');

const droplit = require('droplit-plugin');

class WemoPlugin extends droplit.DroplitPlugin {
    constructor() {
        super();
        
        this.devices = new Map();
        
        this.discoverer = new Discoverer();
        this.discoverer.on('discovered', onDiscovered.bind(this));
        this.discoverer.on('ipchange', onDiscoverIPChange.bind(this));
        
        this.services = {
            BinarySwitch: {
                get_switch: this.getSwitch,
                set_switch: this.setSwitch,
                switchOff: this.switchOff,
                switchOn: this.switchOn
            },
            CoffeeMaker: {
                brew: this.brew,
                get_state: this.getState
            }
        }
        
        function onDiscovered(device) {
            if (this.devices.has(device.identifier))
                return;
            
            let client = Clients.WemoClient.create(device);
            client.on('prop-change', data => {
                this.onPropertiesChanged([data]);
            });
            this.devices.set(device.identifier, client);
            this.onDeviceInfo(client.discoverObject());
        }
        
        function onDiscoverIPChange(data) {
            let identifier = data.identifier;
            let address = data.ip.host;
            let client = this.devices.get(identifier);
            if (!client)
                return;
            client.address = address;
            this.onDeviceInfo({ address, identifier });
        }
    }
    
    discover() {
        this.discoverer.discover();
    }
    
    dropDevice(localId) {
        let device = this.devices.get(localId);
        if (!device)
            return false;
        
        let identifier = device.identifier;
        device.removeAllListeners('prop-change');
        this.devices.delete(identifier);
        this.discoverer.undiscover(identifier);
    }
    
    // BinarySwitch Implementation
    getSwitch(localId, callback) {
        let device = this.devices.get(localId);
        if (device && device.getState)
            device.getState((err, state) => {
                if (err)
                    return;
                callback(state ? 'on' : 'off');
            });
    }
    
    setSwitch(localId, value) {
        if (value === 'off')
            this.switchOff(localId);
        else if (value === 'on')
            this.switchOn(localId);
    }
    
    switchOff(localId) {
        let device = this.devices.get(localId);
        if (device && device.switchOff)
            device.switchOff(() => { });
    }
    
    switchOn(localId) {
        let device = this.devices.get(localId);
        if (device && device.switchOn)
            device.switchOn(() => { });
    }
    
    // CoffeeMaker Implementation
    brew(localId) {
        let device = this.devices.get(localId);
        if (device && device.brew)
            device.brew(() => { });
    }
    
    getState(localId, callback) {
        let device = this.devices.get(localId);
        if (device && device.getMode) {
            device.getMode((err, mode) => {
                if (err)
                    return;
                callback(mode);
            });
        }
    }
}

module.exports = WemoPlugin;