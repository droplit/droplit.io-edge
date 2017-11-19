const EventEmitter = require('events').EventEmitter;
const ssdp = require('node-ssdp').Client;
const url = require('url');

const upnpSearch = 'nanoleaf_aurora:light';

class Discoverer extends EventEmitter {
    constructor() {
        super();

        this.client = new ssdp();
        this.found = new Map();

        this.client.on('response', udpResponse.bind(this));

        function udpResponse(headers, statusCode, rinfo) {
            // Ignore devices without the Nanoleaf ST
            if (headers.ST !== 'nanoleaf_aurora:light')
                return;

            // Ensure headers to get unique identifier
            if (!headers['NL-DEVICEID'] || !headers.USN)
                return;

            // If no bridge id, fallback to USN
            const identifier = (headers['NL-DEVICEID'] || headers.USN).toUpperCase();
            if (this.found.has(identifier)) {
                // Check for IP address change of known device
                if (this.found.get(identifier).location.hostname === rinfo.address)
                    return;

                this.found.get(identifier).location = url.parse(headers.LOCATION);
                this.emit('ipchange', { identifier, ip: this.found.get(identifier).location });
                return;
            }

            const discoveryData = {
                identifier,
                location: url.parse(headers.LOCATION),
                name: headers['NL-DEVICENAME'] || 'Nanoleaf Aurora'
            };
            this.found.set(identifier, discoveryData);
            this.emit('discovered', discoveryData);
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
