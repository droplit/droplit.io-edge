import * as request from 'request';
import * as events from 'events';
import * as url from 'url';

let ssdp = require('node-ssdp').Client;
let EventEmitter = events.EventEmitter;

const upnpSearch = 'venstar:thermostat:ecp';

class Discoverer extends EventEmitter {
    client: any;
    found: any;

    constructor() {
        super();

        this.client = new ssdp();
        this.found = {};

        this.client.on('response', udpResponse.bind(this));

        function getDescription (identifier: any) {
            this.emit('discovered', this.found.identifier);
        }

        function udpResponse(headers: any, statusCode: number, rinfo: any) {
            if (!headers.LOCATION || !headers.ST || !headers.USN) {
                return;
            }

            let idRegEx = new RegExp('([^http/]+)');
            let ipRegEx = new RegExp('^voyager:ecp:([a-zA-Z0-9.]+)');
            let idMatch = headers.USN.match(idRegEx);
            let ipMatch = 'http://' + headers.LOCATION.match(ipRegEx)[1] + '/';

            if (!idMatch) {
                return;
            }

            let identifier = idMatch[1];
            if (identifier in this.found) {
                if (this.found.identifier.location.hostname === rinfo.address) {
                    return;
                }
                // IP address has changed since last discovery
                this.found.identifier.location = url.parse(headers.LOCATION);
                this.emit('ipchange', { identifier: identifier, ip: this.found.identifier.location });
                return;
            }

            let discoveryData = {
                address: rinfo.address,
                identifier,
                location: url.parse(ipMatch),
                port: rinfo.port
            };
            this.found = {identifier: discoveryData};
            this.emit('discovered', this.found.identifier);
        }

    }

    discover() {
        this.client.search(upnpSearch);
    }
    
    undiscover(identifier: string) {
        delete this.found.identifier;
    }
}

module.exports = Discoverer;