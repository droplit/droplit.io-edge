'use strict';

const Discoverer = require('./Discoverer');

const droplit = require('droplit-plugin');

class HuePlugin extends droplit.DroplitPlugin {
    constructor() {
        super();
        
        this.discoverer = new Discoverer();
        this.discoverer.on('discovered', onDiscovered.bind(this));
        this.discoverer.on('ipchange', onDiscoverIPChange.bind(this));
        
        function onDiscovered(device) { }
        
        function onDiscoverIPChange(data) { }
    }
    
    discover() {
        this.discoverer.discover();
    }
    
    dropDevice(localId) { }
}

module.exports = HuePlugin;