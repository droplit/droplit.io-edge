'use strict';

const dgram  = require('dgram');
const droplit = require('droplit-plugin');
const EventEmitter = require('events').EventEmitter;
const os = require('os');
const lifxPacket = require('./Packet');

const MulticastPort = 56700;

let ips = [];

class LifxPlugin extends droplit.DroplitPlugin {
    constructor() {
        super();

        this.bulbs = new Map();
        this.gateways = new Map();
        
        this.udpClient = dgram.createSocket('udp4');
        this.udpClient.on('error', udpError.bind(this));
        this.udpClient.on('message', udpMessage.bind(this));
        
        // May discover devices prior to explicit discover if other devices on network are discovering
        this.udpClient.bind(MulticastPort, '0.0.0.0', () => {
            this.udpClient.setBroadcast(true);
        });
        
        function bulbReady(bulb) {
            this.onDeviceInfo(bulb.discoverObject());
            let output = bulb.outputState();
            let propChanges = [];
            
            propChanges.push(bulb.propertyObject('BinarySwitch', 'switch', output.on));
            propChanges.push(bulb.propertyObject('DimmableSwitch', 'brightness', output.ds_brightness));
            if (bulb.services.some(s => s === 'MulticolorLight')) {
                propChanges.push(bulb.propertyObject('MulticolorLight', 'brightness', output.mcl_brightness));
                propChanges.push(bulb.propertyObject('MulticolorLight', 'hue', output.hue));
                propChanges.push(bulb.propertyObject('MulticolorLight', 'saturation', output.sat));
                propChanges.push(bulb.propertyObject('MulticolorLight', 'temperature', output.temp));
                propChanges.push(bulb.propertyObject('MulticolorLight', 'tempLowerLimit', output.tempLowerLimit));
                propChanges.push(bulb.propertyObject('MulticolorLight', 'tempUpperLimit', output.tempUpperLimit));
            }
            if (propChanges.length > 0)
                this.onPropertiesChanged(propChanges);
        }
        
        function getIps() {
            if (ips.length > 0)
                return ips;
                
            let ipSet = new Set();
            let interfaces = os.networkInterfaces();
            Object.keys(interfaces).forEach(name =>
                interfaces[name].forEach(info =>
                    ips.add(info.address)));
                    
            ips = Array.from(ipSet);
            return ips;
        }
        
        function processPacket(packet, rinfo) {
            let address = packet.preamble.bulbAddress.toString('hex');
            
            switch (packet.packetTypeShortName) {
                case 'getService':
                    break;
                case 'stateService':
                    if (packet.payload.service === 1 && packet.payload.port > 0) {
                        if (!this.gateways.has(rinfo.address)) {
                            let gateway = {
                                ip: rinfo.address,
                                port: packet.payload.port,
                                site: packet.preamble.site,
                                service: packet.payload.service,
                                protocol: packet.preamble.protocol,
                                bulbAddress: packet.preamble.bulbAddress.toString('hex')
                            };
                            this.gateways.set(rinfo.address, gateway);
                            this.send(lifxPacket.getVersion(), packet.preamble.bulbAddress);
                        }
                    }
                    break;
                case 'stateHostInfo':
                    break;
                case 'stateWifiInfo':
                    break;
                case 'getVersion':
                    break;
                case 'stateVersion':
                    if (!this.bulbs.has(address)) {
                        this.bulbs.set(address, new LifxBulb(address));
                        this.bulbs.get(address).on('ready', bulbReady.bind(this));
                    }
                    this.bulbs.get(address).version = packet.payload;
                    
                    break;
                case 'lightState':
                    if (!this.bulbs.has(address)) {
                        this.bulbs.set(address, new LifxBulb(address));
                        this.bulbs.get(address).on('ready', bulbReady.bind(this));
                    }
                    let state = {
                        hue: packet.payload.hue,
                        saturation: packet.payload.saturation,
                        brightness: packet.payload.brightness,
                        kelvin: packet.payload.kelvin,
                        power: packet.payload.power
                    };
                    this.bulbs.get(address).state = state;
                    if (this.bulbs.get(address).version === undefined)
                        this.send(lifxPacket.getVersion(), packet.preamble.bulbAddress);
                    
                    break; 
            }
        }
        
        function udpError(err) { }
        
        function udpMessage(msg, rinfo) {
            if (ips.some(ip => ip === rinfo.address))
                return;

            let packet = lifxPacket.fromBytes(msg);
            if (packet)
                processPacket.bind(this)(packet, rinfo);
        }
    }
    
    discover() {
        this.udpClient.send(lifxPacket.getService(), 0, packet.length, MulticastPort, '255.255.255.255', (err, bytes) => { });
    }
    
    send(packet, address) {
        if (address)
            address.copy(packet, 8);
        for (let gateway of this.gateways.values()) {
            let site = gateway.site;
            site.copy(packet, 16);
            if (gateway.bulbAddress === address.toString('hex'))
                this.udpClient.send(packet, 0, packet.length, gateway.port, gateway.ip, (err, bytes) => { });
        }
    }
}

const _ready = Symbol('ready');
const _state = Symbol('state');
const _version = Symbol('version');

function normalize(value, min, max, mult) {
    mult = mult || 100;
    return parseInt(((value - min) / (max - min)) * mult);
}

const TempLower = 2500;
const TempUpper = 9000;

class LifxBulb extends EventEmitter {
    constructor(address) {
        super();
        
        this.address = address;
        this.deviceMeta = { name: '' };
        this.product = {};
        this.services = [];
        this.promotedMembers = {
            switch: 'BinarySwitch.switch',
            brightness: 'DimmableSwitch.brightness'
        };
        
        this[_ready];
        this[_state];
        this[_version];
    }
    
    discoverObject() {
        return {
            localId: this.address,
            address: this.address,
            product: this.product,
            services: this.services,
            promotedMembers: this.promotedMembers
        };
    }
    
    outputState() {
        return {
            ds_brightness: normalize(this.state.brightness, 0, 0xFFFF), 
            hue: this.state.hue,
            mcl_brightness: this.state.brightness,
            on: this.state.power > 0 ? 'on' : 'off',
            sat: this.state.saturation,
            temp: this.state.kelvin,
            tempLowerLimit: TempLower,
            tempUpperLimit: TempUpper
        };
    }
    
    propertyObject(service, member, value) {
        return {
            localId: this.address,
            service,
            member,
            value
        };
    }
    
    get state() { return this[_state]; }
    set state(state) {
        this[_state] = state;
        
        if (this[_version] && !this[_ready]) {
            this[_ready] = true;
            this.emit('ready', this);
        }
    }
    
    get version() { return this[_version]; }
    set version(version) { 
        this[_version] = version;
        let isWhite = (version.product === 167772160);
        this.product.modelName = isWhite ? 'LIFX White' : 'LIFX';
        this.services = isWhite ?
            ['BinarySwitch', 'DimmableSwitch'] :
            ['BinarySwitch', 'DimmableSwitch', 'MulticolorLight'];
        
        if (this[_state] && !this[_ready]) {
            this[_ready] = true;
            this.emit('ready', this);
        }
    }
}

module.exports = LifxPlugin;