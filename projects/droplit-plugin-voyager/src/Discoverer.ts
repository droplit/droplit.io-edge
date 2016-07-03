import * as events from 'events';
import * as url from 'url';

let ssdp = require('node-ssdp').Client;

const upnpSearch = 'venstar:thermostat:ecp';

export class Discoverer extends events.EventEmitter {
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
            if (!headers.LOCATION) {
                return;
            } 
            if (!headers.ST || !headers.USN) {
                return;
            }

            // let ipRegEx = /^http(?:s)?:?\/\/((?:\d{1,3}\.){3}\d{1,3})/i;
            let idRegEx = /^voyager:ecp:((?:(?:[A-F0-9.]){3}){5}(?:[A-F0-9.]{2})):name:(.*):type:(.+)/;

            let idMatch = headers.USN.match(idRegEx);
            
            if (!idMatch) {
                return;
            }

            // let ipMatch = 'http://' + headers.LOCATION.match(ipRegEx)[1] + '/';
            let ipMatch = 'http://' + rinfo.address + '/';

            let identifier = idMatch[1];
            if (identifier in this.found) {
                if (this.found[identifier].location.hostname === rinfo.address) {
                    return;
                }
                // IP address has changed since last discovery
                this.found[identifier].location = url.parse(ipMatch);
                this.emit('ipchange', { identifier: identifier, ip: this.found[identifier].location });
                return;
            }

            let discoveryData = {
                address: rinfo.address,
                identifier,
                location: url.parse(ipMatch),
                deviceInfo: {
                    name: idMatch[2],
                    type: idMatch[3]
                }
            };
            this.found[identifier] = discoveryData;
            this.emit('discovered', discoveryData);
        }

    }

    discover() {
        this.client.search(upnpSearch);
    }
    
    undiscover(identifier: string) {
        delete this.found.identifier;
    }
}
