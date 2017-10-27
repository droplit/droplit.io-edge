'use strict';

const EventEmitter = require('events').EventEmitter;
const request = require('request-lite');
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
                if (e || !b)
                    return;
                xml.Parser({ explicitRoot: false, explicitArray: false })
                    .parseString(b, (error, result) => {
                        if (error)
                            return;
                        const valid = [
                            /urn:Belkin:device:CoffeeMaker:1/g, // Mr. Coffee
                            /urn:Belkin:device:controllee:1/g,  // Switch
                            /urn:Belkin:device:insight:1/g,     // Insight
                            /urn:Belkin:device:lightswitch:1/g, // LightSwitch
                            /urn:Belkin:device:sensor:1/g       // Motion Sensor
                        ];
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

            const idRegex = new RegExp(`^(uuid:.+)::${headers.ST}$`);
            const match = headers.USN.match(idRegex);
            // Cannot extract identifier from USN
            if (!match)
                return;

            const identifier = match[1];
            if (this.found.has(identifier)) {
                if (this.found.get(identifier).location.hostname === rinfo.address)
                    return;
                // Wemo has changed IP address since last discovery
                this.found.get(identifier).location = url.parse(headers.LOCATION);
                this.emit('ipchange', { identifier, ip: this.found.get(identifier).location });
                return;
            }

            const discoveryData = {
                identifier,
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
