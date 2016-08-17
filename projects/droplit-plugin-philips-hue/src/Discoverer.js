'use strict';

const EventEmitter = require('events').EventEmitter;
const request = require('request');
const ssdp = require('node-ssdp').Client;
const url = require('url');
const xml = require('xml2js');

const upnpSearch = 'urn:schemas-upnp-org:device:Basic:1';

class Discoverer extends EventEmitter {
    constructor() {
        super();

        this.client = new ssdp();
        this.found = new Map();

        this.reading = {};

        this.client.on('response', udpResponse.bind(this));

        this._checkBrokerServer = checkBrokerServer.bind(this);
        this.checkBroker = false;

        function checkBrokerServer() {
            if (!this.checkBroker)
                return;

            request('http://www.meethue.com/api/nupnp', (e, r, b) => {
                if (e)
                    return;
                if (b) {
                    const bridgeData = JSON.parse(b);
                    bridgeData.forEach(data => {
                        const identifier = data.id.toUpperCase();
                        const ip = data.internalipaddress;
                        const location = url.parse(`http://${ip}:80/description.xml`);

                        if (this.found.has(identifier)) {
                            if (this.found.get(identifier).location.hostname === ip)
                                return;
                            // Hue bridge has changed IP address since last discoveryData
                            this.found.get(identifier).location = location;
                            this.emit('ipchange', { identifier, ip: this.found.get(identifier).location });
                            return;
                        }

                        const discoveryData = {
                            identifier,
                            location
                        };

                        this.found.set(identifier, discoveryData);

                        if (!this.found.get(identifier).hasOwnProperty('info') && !this.reading[identifier]) {
                            this.reading[identifier] = true;
                            getDescription.bind(this)(identifier);
                        }
                    });
                }
            });
        }

        function getDescription(identifier) {
            request(this.found.get(identifier).location.href, (e, r, b) => {
                if (e || !b)
                    return;

                xml.Parser({ explicitRoot: false, explicitArray: false })
                    .parseString(b, (error, result) => {
                        if (error)
                            return;
                        if (/Philips hue bridge/g.test(b)) {
                            this.found.get(identifier).info = result;
                            this.reading[identifier] = false;
                            this.emit('discovered', this.found.get(identifier));
                        }
                    });
            });
        }

        function udpResponse(headers, statusCode, rinfo) {
            // Ignore devices that don't match the Hue LOCATION pattern
            if (!headers.LOCATION || !/^http:\/\/\d{1,3}[.]\d{1,3}[.]\d{1,3}[.]\d{1,3}(?:[:]\d+)\/description.xml$/.test(headers.LOCATION))
                return;

            // Ensure headers to get unique identifier
            if (!headers['HUE-BRIDGEID'] || !headers.USN)
                return;

            this.checkBroker = false;

            // If no bridge id, fallback to USN
            const identifier = (headers['HUE-BRIDGEID'] || headers.USN).toUpperCase();
            if (this.found.has(identifier)) {
                if (this.found.get(identifier).location.hostname === rinfo.address)
                    return;
                // Hue bridge has changed IP address since last discoveryData
                this.found.get(identifier).location = url.parse(headers.LOCATION);
                this.emit('ipchange', { identifier, ip: this.found.get(identifier).location });
                return;
            }

            const discoveryData = {
                identifier,
                location: url.parse(headers.LOCATION)
            };

            this.found.set(identifier, discoveryData);

            if (!this.found.get(identifier).hasOwnProperty('info') && !this.reading[identifier]) {
                this.reading[identifier] = true;
                getDescription.bind(this)(identifier);
            }
        }
    }

    discover() {
        this.client.search(upnpSearch);
        this.checkBroker = true;
        setTimeout(() =>
            this._checkBrokerServer(), 10000);
    }

    undiscover(identifier) {
        this.found.delete(identifier);
    }
}

module.exports = Discoverer;
