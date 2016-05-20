'use strict';

const droplit = require('droplit-plugin');
const EventEmitter = require('events').EventEmitter;
const request = require('request');
const ssdp = require('node-ssdp').Client;
const url = require('url');
const xml = require('xml2js');

const upnpSearch = 'urn:Belkin:service:basicevent:1';

class WemoPlugin extends droplit.DroplitPlugin {
    constructor() {
        super();
        
        this.devices = new Map();
        
        this.discoverer = new Discoverer();
        this.discoverer.on('discovered', onDiscovered.bind(this));
        this.discoverer.on('ipchange', onDiscoverIPChange.bind(this));
        this.discoverer.discover();
        
        function onDiscovered(device) {
            if (this.devices.has(device.identifier))
                return;
            
            let client = WemoClient.create(device);
            this.devices.set(device.identifier, device);
            this.onDeviceInfo(client.discoverObject());
        }
        
        function onDiscoverIPChange(data) { }
    }
}

class Discoverer extends EventEmitter {
    constructor() {
        super();
        
        this.client = new ssdp();
        this.found = new Map();
        
        this.client.on('response', udpResponse.bind(this));
        
        function getDescription(identifier) {
            request(this.found.get(identifier).location.href, (e, r, b) => {
                if (!b)
                    return;
                xml.Parser({ explicitRoot: false, explicitArray: false })
                    .parseString(b, (error, result) => {
                        if (error)
                            return;
                        let valid = [/WeMo Switch/g, /WeMo Insight/g, /WeMo LightSwitch/g, /CoffeeMaker/g];
                        if (valid.some(pattern => pattern.test(b))) {
                            this.found.get(identifier).info = result;
                            this.emit('discovered', this.found.get(identifier));
                        }
                });
            });
        }
        function udpResponse(headers, statusCode, rinfo) {
            // Ignore devices that don't match the WeMo LOCATION pattern
            if (!headers.LOCATION || !/^(?:.*)setup[.]xml$/.test(headers.LOCATION))
                return;
            
            // Ensure headers to get unique identifier
            if (!headers.ST || !headers.USN)
                return;

            let idRegex = new RegExp('^(uuid:.+)::' + headers.ST + '$');
            let match = headers.USN.match(idRegex);
            // Cannot extract identifier from USN
            if (!match)
                return;
            
            let identifier = match[1];
            if (this.found.has(identifier)) {
                if (this.found.get(identifier).location.hostname == rinfo.address)
                     return;
                // Wemo has changed IP address since last discovery 
                this.found.get(identifier).location = url.parse(headers.LOCATION);
                this.emit('ipchange', { identifier: identifier, ip: this.found.get(identifier).location });
                return;
            }
        
            var discoveryData = {
                identifier: identifier,
                location: url.parse(headers.LOCATION)
            };
            this.found.set(identifier, discoveryData);
            if (!this.found.get(identifier).info)
                getDescription.bind(this)(identifier);
        }
    }
    
    discover() {
        this.client.search(upnpSearch);
    }
}

class WemoClient {
    constructor(init) {
        this.address = init.location.address;
        this.identifier = init.identifier;
        this.product = {
            friendlyName: init.info.device.friendlyName,
            manufacturer: init.info.device.manufacturer,
            modelDescription: init.info.device.modelDescription,
            modelName: init.info.device.modelName,
            modelNumber: init.info.device.modelNumber
        };
    }
    
    static create(init) {
        if (init.info.device.modelName === 'CoffeeMaker')
            return new WemoCoffeeMaker(init);
        return new WemoSwitch(init);
    }
    
    discoverObject() {
        return {
            localId: this.identifier,
            address: this.address,
            product: this.product,
            deviceMeta: { name: `Belkin WeMo ${this.product.modelName}` },
            services: this.services,
            promotedMembers: this.promotedMembers
        };
    }
}

class WemoSwitch extends WemoClient {
    constructor(init) {
        super(init);

        this.promotedMembers = {
            switch: 'BinarySwitch.switch',
            switchOff: 'BinarySwitch.switchOff',
            switchOn: 'BinarySwitch.switchOn'
        };
        this.services = ['BinarySwitch'];
    }
}

class WemoCoffeeMaker extends WemoClient {
    constructor(init) {
        super(init);
        
        this.promotedMembers = { brew: 'CoffeeMaker.brew' };
        this.services = ['CoffeeMaker'];
    }
}

module.exports = WemoPlugin;