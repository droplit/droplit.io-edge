'use strict';

const DroplitPlugin = require('./DroplitPlugin');
const EventEmitter  = require('events');
const Ssdp =          require('node-ssdp').Client;

const https =         require('https');
const request =       require('request');
const url =           require('url');
const util =          require('util');
const xml =           require('xml2js');

/** Class representing a Maybe monad */
class Maybe {
    constructor (x) { this._value = x; }
    static of (x) { return new Maybe(x); }
    
    map (fn) { return this.nothing() ? this : Maybe.of(fn(this._value)) };
    nothing () { return this._value === undefined || this._value === null }
    something () { return !this.nothing(); }
}

/** Class representing a UDI ISY controller */
class Controller {
    /**
     * Create a controller
     * @param {string} address - The controller's IP address
     * @param {object} info - JS representation of the upnp description XML
     */
    constructor (address, info) {
        this._address = address;
        this._identifier = info.UDN; 
        this._info = info;
        this._nodes = new Map();
        
        this.soapActions = {
            GetNodesConfig: {
                action: '"urn:udi-com:service:X_Insteon_Lighting_Service:1#GetNodesConfig"',
                envelope: '<s:Envelope><s:Body><u:GetNodesConfig xmlns:u="urn:udi-com:service:X_Insteon_Lighting_Service:1"></u:GetNodesConfig></s:Body></s:Envelope>' 
            }
        };
    }
    
    /**
     * Get the controller IP address
     * @return {string} The address value
     */
    get address () { return this._address; }
    /**
     * Get the controller's unique identifier
     * @return {string} The identifier value
     */
    get identifier () { return this._identifier; }
    
    /** Get the nodes that exist on the controller */
    getNodesConfig () {
        this.soapAction('/services', this.soapActions.GetNodesConfig.action, this.soapActions.GetNodesConfig.envelope)
            .then(result => {
                xml.Parser({ explicitRoot: false, explicitArray: false })
                    .parseString(result.body, (xmlErr, parsed) => {
                        if (xmlErr) {
                            console.log(`xml parse error: ${xmlErr}`);
                            return;
                        }
                        let data = parsed['s:Body'];
                        if (data.hasOwnProperty('UDIDefaultResponse')) {
                            console.log('response failed');
                            return;
                        }
                        for (let nodeData of data.nodes.node) {
                            let node = ZWNode.create({ data: nodeData, host: this._address });
                            if (node) {
                                this._nodes.set(node.address, node);
                                console.log('discovery message', node.discovered);
                                node.get_switch().then(rst => {
                                    console.log('result', rst);
                                });
                            }
                        }
                });
            })
            .catch(err => console.log(`err: ${err}`));
    }
       
    /**
     * Issue a SOAP action request
     * @param {string} path - The path of the SOAP request
     * @param {string} action - The SOAPACTION header
     * @param {string} soap - The SOAP envelope
     */
    soapAction (path, action, soap) {
        return new Promise((resolve, reject) => {
            let uri = url.format({ host: this._address, pathname: path, protocol: 'https:' });
            let options = {
                agent: new https.Agent({ rejectUnauthorized: false }),
                auth: { user: 'admin', pass: 'admin' },
                body: soap,
                headers: {
                    'SOAPACTION': action,
                    'CONTENT-LENGTH': soap.length
                },
                method: 'POST',
                uri: uri
            };
            request(options, (err, res, body) => {
                if (err || !body) {
                    if (res && res.hasOwnProperty('statusCode') && res.statusCode != 200)
                        console.log(`status: ${res.statusCode}`);
                    return reject(err);
                }
                return resolve({ err, res, body });
            });
        });
    }
}

/** Class for discovering UDI ISY controllers */
class Discoverer extends EventEmitter {
    /** Create a Discoverer */
    constructor () {
        super();
        
        this.client = new Ssdp();
        this.discovered = new Map();
        
        this.client.on('response', handleUDPResponse.bind(this));
        
        function handleUDPResponse (headers, statusCode, rinfo) {
            // Ignore description XML for devices that don't match the ISY pattern
            if (!headers.LOCATION || !/^(?:.*)\/desc$/.test(headers.LOCATION))
                return;
                
            let isy = headers.LOCATION || undefined;
            // Device already discovered
            if (this.discovered.has(isy))
                return;
                
            this.discovered.set(isy, { headers: headers, rinfo: rinfo });
            request(isy, (err, res, bdy) => {
                if (err || !bdy)
                    return;
                xml.Parser({ explicitRoot: false, explicitArray: false })
                    .parseString(bdy, (xmlerr, result) => {
                        if (xmlerr)
                            return;
                        if (/urn:udi-com:device:X_Insteon_Lighting_Device:1/g.test(bdy))
                            this.emit('discovered', { address: rinfo.address, info: result.device });
                    });
            });
        }
    }
    
    /** Initiate a upnp search */
    search () { this.client.search('upnp:rootdevice'); }
}

/** A mixin for ZWNode BinarySwitch capibility */
class BinarySwitchMixin {
    static get service () { return 'BinarySwitch'; }
    
    get_switch () {
        return new Promise((resolve, reject) => {
            this.restAction(`/rest/nodes/${this.address}/ST`)
                .then(result => {
                    let value = 'off';
                    if (hasPropChain(result, 'property.$.id') && hasPropChain(result, 'property.$.value') && result.property.$.id === 'ST')
                        value = (result.property.$.value > 0) ? 'on' : 'off';
                    return resolve(value);
                })
                .catch(err => reject(err));
        });
    }
    set_switch (value) {
        if (value === 'off')
            return this.switchOff();
        else if (value === 'on')
            return this.switchOn();
        return Promise.resolve(null);
    }
    switchOff () {
        return new Promise((resolve, reject) => {
            let soap = this.soapActions.UDIService.Dof.envelope.replace(/\{(id)\}/gi, match => this.address);
            this.soapAction('/services', this.soapActions.UDIService.action, soap)
                .then(result => resolve(result))
                .catch(err => reject(err));
        });
    }
    switchOn () {
        return new Promise((resolve, reject) => {
            let replacement = { id: this.address, value: '' };
            let soap = this.soapActions.UDIService.Don.envelope.replace(/\{([a-z]+)\}/gi, match => {
                return replacement.hasOwnProperty(RegExp.$1) ? replacement[RegExp.$1] : match;
            });
            this.soapAction('/services', this.soapActions.UDIService.action, soap)
                .then(result => resolve(result))
                .catch(err => reject(err));
        });
    }
}

/** A mixin for ZWNode DimmableSwitch capibility */
class DimmableSwitchMixin {
    static get service () { return 'DimmerSwitch'; }
    
    get_brightness () {  }
    set_brightness (value) {  }
    stepDown () {  }
    stepUp () {  }
}

/** Class representing a Z Wave Node */
class ZWNode {
    /** Create a Discoverer */
    constructor (init) {
        this.data = init.data;
        this.host = init.host;
        this.services = new Set();
        
        this.soapActions = {
            GetNodeInfo: {
                action: '"urn:udi-com:service:X_Insteon_Lighting_Service:1#GetNodeInfo"',
                envelope: '<s:Envelope><s:Body><u:GetNodeInfo xmlns:u="urn:udi-com:service:X_Insteon_Lighting_Service:1"><id>{id}</id></u:GetNodeInfo></s:Body></s:Envelope>'
            },
            UDIService: {
                action: '"urn:udi-com:service:X_Insteon_Lighting_Service:1#UDIService"', 
                Dof: {
                    envelope: '<s:Envelope><s:Body><u:UDIService xmlns:u="urn:udi-com:service:X_Insteon_Lighting_Service:1"><control>DOF</control><action UOM="51" PREC="-1"></action><flag>65531</flag><node>{id}</node></u:UDIService></s:Body></s:Envelope>'
                },
                Don: {
                    envelope: '<s:Envelope><s:Body><u:UDIService xmlns:u="urn:udi-com:service:X_Insteon_Lighting_Service:1"><control>DON</control><action UOM="51" PREC="-1">{value}</action><flag>65531</flag><node>{id}</node></u:UDIService></s:Body></s:Envelope>'
                }
            }  
        };
    }
    
    /** ZWNode factory for creating ZWNodes of the correct type */
    static create (init) {
        let category = +init.data.devtype.cat;
        let types = ZWNode.typemap();
        if (types.has(category))
            return new (types.get(category))(init);
        return null; 
    }
    
    /** A map of category ids to ZWNode device type classes */
    static typemap () {
        return new Map([
            [109, ZWDimmerSwitch]
        ]);
    }
    
    /**
     * Get the node's address
     * @return {string} The address value
     */
    get address () { return this.data.address; }
    
    /**
     * Get the node's category id
     * @return {number} The id value
     */
    get category () { return +this.data.devtype.cat; }
    
    /**
     * Gets the discovery object for this node 
     * @return {object} The discovery object
     */
    get discovered () {
        return {
            address: this.host,
            identifier: this.address,
            manufacturer: this.manufacturer,
            productName: this.name,
            productType: '',
            name: '',
            services: this.services
        };
    }
    
    /**
     * Get the node's manufacturer id
     * @return {string} The id value
     */
    get manufacturer () { return this.data.devtype.mfg; }
    
    /**
     * Get the node's name
     * @return {string} The name value
     */
    get name () { return this.data.name; }
    
    /**
     * Get the node's model id
     * @return {string} The id value
     */
    get type () { return this.data.type; }
    
    /**
     * Issue a REST request
     * @param {string} path - The path of the request request
     */
    restAction (path) {
        return new Promise((resolve, reject) => {
            let uri = url.format({ host: this.host, pathname: path, protocol: 'https:' });
            let options = {
                agent: new https.Agent({ rejectUnauthorized: false }),
                auth: { user: 'admin', pass: 'admin' },
                method: 'GET',
                uri: uri
            };
            request(options, (err, res, body) => {
                if (err || !body) {
                    if (res && res.hasOwnProperty('statusCode') && res.statusCode != 200)
                        console.error(`status: ${res.statusCode}`);
                    return reject(err);
                }
                xml.Parser({ explicitRoot: false, explicitArray: false })
                    .parseString(body, (xmlErr, parsed) => {
                        if (xmlErr) {
                            console.log(`xml parse error: ${xmlErr}`);
                            return reject(xmlErr);
                        }
                        return resolve(parsed);
                    });
            });
        });
    }
    
    /**
     * Issue a SOAP action request
     * @param {string} path - The path of the SOAP request
     * @param {string} action - The SOAPACTION header
     * @param {string} soap - The SOAP envelope
     */
    soapAction (path, action, soap) {
        return new Promise((resolve, reject) => {           
            let uri = url.format({ host: this.host, pathname: path, protocol: 'https:' });
            let options = {
                agent: new https.Agent({ rejectUnauthorized: false }),
                auth: { pass: 'admin', user: 'admin' },
                body: soap,
                headers: {
                    'SOAPACTION': action,
                    'CONTENT-LENGTH': soap.length
                },
                method: 'POST',
                uri: uri
            };
            request(options, (err, res, body) => {
                if (err || !body) {
                    if (res && res.hasOwnPropery('statusCode') && res.statusCode != 200)
                        console.log(`status: ${res.statusCode}`);
                    return reject(err);
                }
                xml.Parser({ explicitRoot: false, explicitArray: false })
                    .parseString(body, (xmlErr, parsed) => {
                        if (xmlErr) {
                            console.log(`xml parse error: ${xmlErr}`);
                            return reject(xmlErr);
                        }
                        return resolve(parsed);
                    });
            });
        });
    }
}

/** TODO: For ease of growth/mantainance, it may be better to dynamically construct class from config rather than explicit class */
/** Class representing a Z Wave Dimmer Switch */
class ZWDimmerSwitch extends ZWNode {
    constructor (init) {
        super(init);
        
        this.services.add(BinarySwitchMixin.service);
        this.services.add(DimmableSwitchMixin.service);
    }
    
    /**
     * Gets the discovery object for this node 
     * @return {object} The discovery object
     */
    get discovered () {
        return Object.assign(super.discovered, { promotedMembers: { 'switch': 'BinarySwitch.switch' }});
    }
}
mixin(ZWDimmerSwitch, BinarySwitchMixin);
mixin(ZWDimmerSwitch, DimmableSwitchMixin);

/**
 * Adds mixin methods to a class
 * @param {object} target - The target class to add the mixin to
 * @param {object} source - The mixin class being added
 */
function mixin(target, source) {
  target = target.prototype;
  source = source.prototype;
  
  Object.getOwnPropertyNames(source).forEach(name => {
    if (name !== 'constructor')
        Object.defineProperty(target, name, Object.getOwnPropertyDescriptor(source, name));
  });
}

/**
 * Check if a chain of properties is valid
 * @param {object} target - The object to check against
 * @param {string} chain - A string representation of a property chain using dot notation
 */
function hasPropChain (target, chain) {
    let pmap = (m, p) => m.map(o => o[p]);
    return !target ? Maybe.of(target).something() :
        (chain ? chain.split('.') : []).reduce(pmap, Maybe.of(target)).something();
}

/** Plugin for the UDI ISY */
function UdiIsyPlugin () {
    UdiIsyPlugin.super_.call(this);
    
    let self = this;    
    
    let controllers = new Map();
    let discoverer = new Discoverer();
    
    discoverer.on('discovered', data => {
        let controller = new Controller(data.address, data.info);
        controllers.set(controller.identifier, controller);
        console.log('controllers', controller.address);
        controller.getNodesConfig();
    });
    
    this.connect = function (connectInfo) {
        self.log('ISY connecting...');
        self.discover();
    }
    this.discover = function () {
        discoverer.search();
    }
    
    self.services = { }
}

util.inherits(UdiIsyPlugin, DroplitPlugin);
module.exports = UdiIsyPlugin;