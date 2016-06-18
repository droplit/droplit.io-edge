'use strict';

const dgram = require('dgram');
const EventEmitter = require('events').EventEmitter;
const os = require('os');
const request = require('request');
const ssdp = require('node-ssdp').Client;
const url = require('url');
const xml = require('xml2js');

const upnpSearch = 'urn:schemas-upnp-org:device:ZonePlayer:1';
const search = new Buffer([
    'M-SEARCH * HTTP/1.1',
    'HOST: 239.255.255.250:reservedSSDPport',
    'MAN: ssdp:discover',
    'MX: 1',
    'ST: ' + upnpSearch].join('\r\n'));

class Discoverer extends EventEmitter {
    constructor() {
        super();
        
        // Use dummy in cases where node can’t list interfaces (freeBSD)
        this.sockets = { dummy: null };
        // Find all interfaces
        let interfaces = os.networkInterfaces();
        Object.keys(interfaces).forEach(name => {
            interfaces[name].forEach(ipInfo => {
                if (ipInfo.internal === false && ipInfo.family === 'IPv4') {
                    delete this.sockets['dummy'];
                    this.sockets[ipInfo.address] = null;
                }
            });
        });

        Object.keys(this.sockets).forEach(ip => {
            let socket = dgram.createSocket('udp4', udpResponse.bind(this));
            socket.on('error', e => {
                console.log('error', e);
            });
            socket.on('listening', (socket => {
                let addrInfo = socket.address();
                console.log(`listening: ${addrInfo.address}:${addrInfo.port}`);
                socket.setMulticastTTL(1);
            }).bind(this, socket));

            if (ip === 'dummy')
                socket.bind();
            else
                socket.bind(0, ip);

            this.sockets[ip] = socket;
        });

        this.found = new Map();

        function udpResponse(buffer, rinfo) {
            let response = buffer.toString('utf8');
            let headerLines = response.split('\r\n');
            let headers = {};

            headerLines.forEach(line => {
                if (/^([^:]+): (.+)/i.test(line))
                    headers[RegExp.$1] = RegExp.$2;
            });

            // Check if a Sonos device
            if (response.indexOf(upnpSearch) === -1)
                return;

            let sonosRegex = new RegExp(`${upnpSearch}$`);
            // Ignore devices that don't match the Sonos USN pattern
            if (!sonosRegex.test(headers.USN))
                return;
                
            if (!headers.USN)
                return;

            console.log('headers', headers);                
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
                return;
            }
            
            this.found.set(identifier, discoveryData);
            getDescription.bind(this)(identifier);
        }
        
        // this.client.on('response', udpResponse.bind(this));
        
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
    }
    
    discover() {
        Object.keys(this.sockets).forEach(ip => {
            let socket = this.sockets[ip];
            if (!socket)
                return;
            socket.send(search, 0, search.length, 1900, '239.255.255.250');
        });
    }
}

module.exports = Discoverer;