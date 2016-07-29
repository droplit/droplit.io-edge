'use strict';

const EventEmitter = require('events').EventEmitter;
const request = require('request');
const ssdp = require('node-ssdp').Client;
const url = require('url');
const xml = require('xml2js');

const upnpSearch = 'urn:Belkin:service:basicevent:1';

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
                        let valid = [/WeMo Switch/g, /WeMo Insight/g, /WeMo LightSwitch/g, /WeMo Motion/g, /CoffeeMaker/g];
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
    
    undiscover(identifier) {
        this.found.delete(identifier);
    }
}

module.exports = Discoverer;