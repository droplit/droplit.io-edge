'use strict';

const Bridge = require('./Bridge');
const Discoverer = require('./Discoverer2');
const droplit = require('droplit-plugin');
const util = require('util');

class SonosPlugin extends droplit.DroplitPlugin {
    constructor() {
        super();
        
        this.bridges = new Map();
        
        this.discoverer = new Discoverer();
        this.discoverer.on('discovered', onDiscovered.bind(this));
        
        function onDiscovered(data) {
            console.log(data.info.device.deviceList)
            // if (data.info.device.modelName === 'Sonos BRIDGE') {
                if (!this.bridges.has(data.identifier)) {
                    let bridge = new Bridge(data);
                    this.bridges.set(data.identifier, bridge);
                    console.log('bridge', bridge);
                }
            // } else {
            //     console.log(`non-bridge at ${data.address}`);
            // }
        }
    }
    
    discover() {
        this.discoverer.discover();
    }
    dropDevice(localId) { }
}

module.exports = SonosPlugin;