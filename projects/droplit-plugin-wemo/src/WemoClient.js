'use strict';

const EventEmitter = require('events').EventEmitter;
const http = require('http');
const os = require('os');
const request = require('request');
const util = require('util');
const xml = require('xml2js');

const subscriptionTimeout = 600;
const xmlOpts = { explicitRoot: false, explicitArray: false };
let ips = [];

class WemoClient extends EventEmitter {
    constructor(init) {
        super();
        
        this.address = init.location.host;
        this.identifier = init.identifier;
        this.product = {
            friendlyName: init.info.device.friendlyName,
            manufacturer: init.info.device.manufacturer,
            modelDescription: init.info.device.modelDescription,
            modelName: init.info.device.modelName,
            modelNumber: init.info.device.modelNumber
        };

        let subIds = new Map();
        
        let notificationPort = 3500;
        let localAddress = getLocalAddress()[0];
        let server = http.createServer(handleNotification.bind(this));
        server.on('error', e => {
            if (e.code === 'EADDRINUSE')
                startServer(++notificationPort);
            else
                console.log(`listen error: ${e.toString()}`);
        });
        server.on('listening', () => {
            subscribe.bind(this)('/upnp/event/basicevent1')
        });
        
        startServer(notificationPort);
     
        function getLocalAddress() {
            if (ips.length > 0)
                return ips;
            let interfaces = os.networkInterfaces();
            Object.keys(interfaces).forEach(name => {
                if (/(loopback|vmware|internal)/gi.test(name))
                    return;
                interfaces[name].forEach(info => {
                    if (!info.internal && info.family === 'IPv4')
                        ips.push(info.address);
                });
            });
            return ips;
        }
        
        function handleNotification(req, res) {
            res.statusCode = 200;
            
            let buffer = [];            
            req.setEncoding('utf-8');
            req.on('data', chunk => buffer.push(chunk));
            req.on('end', () => {
                res.end();
                let message = buffer.join('');
                xml.Parser(xmlOpts)
                    .parseString(message, (err, result) => {
                        if (err)
                            return;
                        if (this.notified)
                            this.notified(result);
                    });
            });
        }
        
        function startServer(port) {
            server.listen(port);
        }
        
        function subscribe(path) {
            let headers = { TIMEOUT: `Second-${subscriptionTimeout}` };
            if (subIds.has(path))
                headers.SID = subIds.get(path);
            else {
                headers.CALLBACK = `<http://${localAddress}:${notificationPort}>`;
                headers.NT = 'upnp:event';
            }
            
            let opts = {
                headers,
                method: 'SUBSCRIBE',
                uri: `http://${this.address}${path}`
            };
            request(opts, (e, r, b) => {
                if (e) {
                    console.log('error', e);
                    return;
                }
                
                subIds.set(path, r.headers.sid);
                if (r.statusCode === 200)
                    setTimeout(() => subscribe.bind(this)(path), subscriptionTimeout * 500);
                else {
                    subIds.delete(path);
                    setTimeout(() => subscribe.bind(this)(path), 30000);
                }
            });
        }
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
    
    propertyChange(service, member, value) {
        this.emit('prop-change', {
            localId: this.identifier,
            service,
            member,
            value
        });
    }
}

class WemoCoffeeMaker extends WemoClient {
    constructor(init) {
        super(init);
        
        this.coffeeMode = {
            0: 'notReady',
            1: 'placeCarafe',
            2: 'refillWater',
            3: 'ready',
            4: 'brewing',
            5: 'brewed',
            6: 'notReady',
            7: 'notReady',
            8: 'brewingCarafeRemoved'
        };
        
        this.mode;
        this.promotedMembers = { brew: 'CoffeeMaker.brew' };
        this.services = ['CoffeeMaker'];
    }
    
    notified(notification) {
        let property = notification['e:property'];
        if (property.hasOwnProperty('attributeList')) {
            let atts = property.attributeList.replace(/[&]lt;/gi, '<').replace(/[&]gt;/gi, '>');
            let attListValue = `<attributeList>${atts}</attributeList>`;
            xml.Parser(xmlOpts).parseString(attListValue, (error, result) => {
                if (error) {
                    console.log('err', error);
                    return;
                }
                if (result.hasOwnProperty('attribute')) {
                    let mode;
                    if (Array.isArray(result.attribute)) {
                        result.attribute.forEach(attr => {
                            if (attr.name === 'Mode')
                                mode = attr.value;
                        });
                    }
                    else if (result.attribute.name === 'Mode')
                        mode = result.attribute.value;
                    if (mode !== this.mode) {
                        this.mode = mode;
                        let modeName = !this.coffeeMode[this.mode] ? 'notReady' : this.coffeeMode[this.mode];
                        this.propertyChange('CoffeeMaker', 'state', modeName);
                    }
                }
            });
        }
    }
}

class WemoSwitch extends WemoClient {
    constructor(init) {
        super(init);

        this.state;
        this.promotedMembers = {
            switch: 'BinarySwitch.switch',
            switchOff: 'BinarySwitch.switchOff',
            switchOn: 'BinarySwitch.switchOn'
        };
        this.services = ['BinarySwitch'];
    }
    
    notified(notification) {
        let property = notification['e:property'];
        if (property.hasOwnProperty('BinaryState')) {
            let state = +property.BinaryState ? 'on' : 'off';
            if (state !== this.state) {
                this.state = state;
                this.propertyChange('BinarySwitch', 'switch', this.state);
            }
        }
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

module.exports = {
    WemoClient,
    WemoCoffeeMaker,
    WemoSwitch
};