'use strict';

const EventEmitter = require('events').EventEmitter;
const request = require('request');
const ssdp = require('node-ssdp').Client;
const url = require('url');
const xml = require('xml2js');

const upnpSearch = 'urn:schemas-upnp-org:device:ZonePlayer:1';

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

                        this.found.get(identifier).info = result;
                        this.emit('discovered', this.found.get(identifier));
                });
            });
        }
        
        function udpResponse(headers, statusCode, rinfo) {
            let sonosRegex = new RegExp(`${upnpSearch}$`);
            
            // Ignore devices that don't match the Sonos USN pattern
            if (!sonosRegex.test(headers.USN))
                return;
                
            if (!headers.USN)
                return;
                
            let idRegex = new RegExp('^(uuid:.+)::' + headers.ST + '$');
            let match = headers.USN.match(idRegex);
            // Cannot extract identifier from USN
            if (!match)
                return;
            
            let identifier = match[1];
            let discoveryData = {
                address: rinfo.address,
                bootseq: headers['X-RINCON-BOOTSEQ'],
                household: headers['X-RINCON-HOUSEHOLD'],
                identifier,
                location: url.parse(headers.LOCATION),
                port: rinfo.port,
                server: headers.SERVER
            };
            
            if (this.found.has(identifier)) {
                // let knownData = this.found.get(identifier);
                // [{ name: 'address', source: rinfo },
                //  { name: 'bootseq', source: discoveryData },
                //  { name: 'household', source: discoveryData },
                //  { name: 'location', source: discoveryData },
                //  { name: 'port', source: rinfo },
                //  { name: 'server', source: discoveryData }].forEach(prop => {
                //     if (knownData[prop.name] !== prop.source[prop.name])
                //         console.log(`${prop.name} (${identifier}): ${knownData[prop.name]} -> ${prop.source[prop.name]}`);
                // });
                return;
            }
            
            this.found.set(identifier, discoveryData);
            getDescription.bind(this)(identifier);
        }
    }
    
    discover() {
        console.log('discover');
        this.client.search(upnpSearch);
    }
}

module.exports = Discoverer;