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
                set_switch: this.setSwitch,
                switchOff: this.switchOff,
                switchOn: this.switchOn
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
        
        function onDiscoverIPChange(data) { }
    }
    
    discover() {
        this.discoverer.discover();
    }
    
    callMethods(properties) {
        properties.forEach(p => {
            if (!p.service || !p.member)
                return;
            if (this.services[p.service] && this.services[p.service][p.member]) {
                let serviceCall = this.services[p.service][p.member];
                serviceCall.bind(this)(p.localId, p.index, p.value);
            }
        });
    }
    
    setProperties(properties) {
        properties.forEach(p => {
            if (!p.service || !p.member)
                return;
            if (this.services[p.service] && this.services[p.service][`set_${p.member}`]) {
                let serviceCall = this.services[p.service][`set_${p.member}`];
                serviceCall.bind(this)(p.localId, p.index, p.value);
            }
        });
        return properties.map(p => true);
    }
    
    // BinarySwitch Implementation
    getSwitch(localId, index, callback) {
        
    }
    
    setSwitch(localId, index, value) {
        if (value === 'off')
            this.switchOff(localId, index);
        else if (value === 'on')
            this.switchOn(localId, index);
    }
    
    switchOff(localId, index) {
        let device = this.devices.get(localId);
        if (device && device.switchOff)
            device.switchOff(() => { });
    }
    
    switchOn(localId, index) {
        let device = this.devices.get(localId);
        if (device && device.switchOn)
            device.switchOn(() => { });
    }
}

module.exports = WemoPlugin;