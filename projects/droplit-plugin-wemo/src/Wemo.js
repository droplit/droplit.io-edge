'use strict';

const droplit = require('droplit-plugin');
const EventEmitter = require('events').EventEmitter;
const request = require('request');
const ssdp = require('node-ssdp').Client;
const url = require('url');
const util = require('util');
const xml = require('xml2js');

const upnpSearch = 'urn:Belkin:service:basicevent:1';

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
            
            let client = WemoClient.create(device);
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
        this.address = init.location.host;
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
    
    static SoappyLoad() {
        return [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">',
            ' <s:Body>',
            '  <u:%s xmlns:u="urn:Belkin:service:basicevent:1">',
            '   <BinaryState>%s</BinaryState>',
            '  </u:%s>',
            ' </s:Body>',
            '</s:Envelope>'
        ].join('\n');
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
    
    switchOff(callback) {
        let payload = util.format(WemoClient.SoappyLoad(), 'SetBinaryState', 0, 'SetBinaryState');
        let opts = {
            method: 'POST',
            body: payload,
            headers: {
                'Content-Type':'text/xml; charset="utf-8"',
                SOAPACTION:'"urn:Belkin:service:basicevent:1#SetBinaryState"',
                'Content-Length':payload.length
            },
            uri: `http://${this.address}/upnp/control/basicevent1`
        };
        request(opts, callback);
    }
    
    switchOn(callback) {
        let payload = util.format(WemoClient.SoappyLoad(), 'SetBinaryState', 1, 'SetBinaryState');
        let opts = {
            method: 'POST',
            body: payload,
            headers: {
                'Content-Type':'text/xml; charset="utf-8"',
                SOAPACTION:'"urn:Belkin:service:basicevent:1#SetBinaryState"',
                'Content-Length':payload.length
            },
            uri: `http://${this.address}/upnp/control/basicevent1`
        };
        request(opts, callback);
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