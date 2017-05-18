'use strict';

const crypto = require('crypto');
const Discoverer = require('./Discoverer');
const droplit = require('droplit-plugin');
const EventEmitter = require('events').EventEmitter;
const request = require('request');

const PollInterval = 1000 * 10; // in ms
const StepSize = 10;
const TempLower = 2000; // in Kelvins
const TempUpper = 6500; // in Kelvins

class HuePlugin extends droplit.DroplitPlugin {
    constructor(config = {}) {
        super();

        this.config = config;

        this.bridges = new Map();

        this.discoverer = new Discoverer();
        this.discoverer.on('discovered', onDiscovered.bind(this));
        this.discoverer.on('ipchange', onDiscoverIPChange.bind(this));

        this._getBridgeByLight = function (identifier) {
            for (const bridge of this.bridges.values()) {
                if (!bridge.registered)
                    continue;
                if (bridge.lights.has(identifier))
                    return bridge;
            }
            return null;
        };

        /* eslint-disable camelcase */
        this.services = {
            BasicAuthBridge: {
                register: this.register,
                get_authenticated: this.getAuthenticated
            },
            BinarySwitch: {
                get_switch: this.getSwitch,
                set_switch: this.setSwitch,
                switchOff: this.switchOff,
                switchOn: this.switchOn
            },
            ColorTemperature: {
                get_temperature: this.getTemperature,
                get_tempLowerLimit: this.getTempLowerLimit,
                get_tempUpperLimit: this.getTempUpperLimit,
                set_temperature: this.setTemperature
            },
            Connectivity: {
                get_status: this.getStatus
            },
            DimmableSwitch: {
                get_brightness: this.getDSBrightness,
                set_brightness: this.setDSBrightness,
                stepDown: this.stepDown,
                stepUp: this.stepUp
            },
            LightColor: {
                get_brightness: this.getMclBrightness,
                get_hue: this.getHue,
                get_saturation: this.getSaturation,
                set_brightness: this.setMclBrightness,
                set_hue: this.setHue,
                set_saturation: this.setSaturation
            }
        };
        /* es-lint-enable camelcase */

        // TODO: Off/on with connect/disconnect
        setInterval(() => {
            if (this.bridges.size === 0)
                return;

            for (const bridge of this.bridges.values())
                bridge.getLights();
        }, PollInterval);

        function onBridgeRegistered(bridge) {
            this.onPropertiesChanged([bridge.propertyObject('BasicAuthBridge', 'authenticated', bridge.registered)]);
        }

        function onDiscovered(data) {
            const identifier = data.identifier;
            let bridge = this.bridges.get(identifier);
            if (bridge === undefined) {
                bridge = new Bridge(data);
                bridge.on('discovered', onLightDiscovered.bind(this));
                bridge.on('registered', onBridgeRegistered.bind(this));
                bridge.on('state-changes', onStateChanges.bind(this));
                bridge.on('username', onUsername.bind(this));

                this.bridges.set(identifier, bridge);
                this.onDeviceInfo(bridge.discoverObject(), info => {
                    if (info.localData && info.localData.hasOwnProperty('username'))
                        bridge.key = info.localData.username;
                    bridge.getLights();
                });
                this.onPropertiesChanged([bridge.propertyObject('Connectivity', 'status', 'online')]);
            }
        }

        function onDiscoverIPChange(data) {
            const identifier = data.identifier;
            const address = data.ip.host;
            const bridge = this.bridges.get(identifier);
            if (!bridge)
                return;
            bridge.address = address;
            this.onDeviceInfo({ address, identifier });
        }

        function onUsername(bridge) {
            this.onDeviceInfo({ localId: bridge.identifier, localData: { username: bridge.key } });
        }

        function onLightDiscovered(light) {
            this.onDeviceInfo(light.discoverObject());
        }

        function onStateChanges(data) {
            const output = data.light.outputState;
            const changes = data.changes.reduce((p, c) => {
                if (data.light.services.some(s => s === 'BinarySwitch') && (c.state === 'on'))
                    p.push(data.light.propertyObject('BinarySwitch', 'switch', output.on));

                if (data.light.services.some(s => s === 'DimmableSwitch') && (c.state === 'bri'))
                    p.push(data.light.propertyObject('DimmableSwitch', 'brightness', output.ds_brightness));

                if (data.light.services.some(s => s === 'ColorTemperature')) {
                    if (c.state === 'ct')
                        p.push(data.light.propertyObject('ColorTemperature', 'temperature', output.ct));
                    if (c.state === 'temp_low')
                        p.push(data.light.propertyObject('ColorTemperature', 'tempLowerLimit', c.value));
                    if (c.state === 'temp_high')
                        p.push(data.light.propertyObject('ColorTemperature', 'tempUpperLimit', c.value));
                }
                if (data.light.services.some(s => s === 'LightColor')) {
                    if (c.state === 'bri')
                        p.push(data.light.propertyObject('LightColor', 'brightness', output.mcl_brightness));
                    if (c.state === 'hue')
                        p.push(data.light.propertyObject('LightColor', 'hue', output.hue));
                    if (c.state === 'sat')
                        p.push(data.light.propertyObject('LightColor', 'saturation', output.sat));
                }
                if (data.light.services.some(s => s === 'Connectivity')) {
                    if (c.state === 'connected')
                        p.push(data.light.propertyObject('Connectivity', 'status', output.connected));
                }

                return p;
            }, []);

            if (changes.length > 0)
                this.onPropertiesChanged(changes);
        }
    }

    discover() {
        this.discoverer.discover();
    }

    dropDevice(localId) {
        // Check if identifier is for bridge
        if (this.bridges.has(localId)) {
            const bridge = this.bridges.get(localId);
            bridge.removeAllListeners('discovered');
            bridge.removeAllListeners('registered');
            bridge.removeAllListeners('stateChanges');
            this.bridges.delete(localId);
            this.discoverer.undiscover(localId);
            return;
        }

        // Check if identifier is for light
        const bridge = this._getBridgeByLight(localId);
        if (!bridge)
            return;

        bridge.lights.delete(localId);
    }

    getState(localId, state, callback) {
        const bridge = this._getBridgeByLight(localId);
        if (!bridge)
            return callback();

        bridge.getLightState(localId, (err, success) => {
            if (err)
                return callback();

            const output = Bridge.outputState(success);
            callback(output[state]);
        });
    }

    pluginMessage(message, callback) {
        if (message === 'devices' && this.config.diagnostics) {
            const bridges = Array.from(this.bridges.keys())
                .map(bridge => ({
                    key: bridge,
                    value: Array.from(this.bridges.get(bridge).lights.keys())
                }));
            callback(bridges);
            return true;
        }
        return false;
    }

    // BasicAuthBridge Implementation
    register(localId) {
        const bridge = this.bridges.get(localId);
        if (!bridge)
            return;
        bridge.register();
    }

    // BinarySwitch Implementation
    getSwitch(localId, callback) {
        this.getState(localId, 'on', callback);
    }

    setSwitch(localId, value) {
        if (value === 'off')
            this.switchOff(localId);
        else if (value === 'on')
            this.switchOn(localId);
    }

    switchOff(localId) {
        const bridge = this._getBridgeByLight(localId);
        if (!bridge)
            return;

        bridge.setState(localId, { on: false });
    }

    switchOn(localId) {
        const bridge = this._getBridgeByLight(localId);
        if (!bridge)
            return;

        bridge.setState(localId, { on: true });
    }

    // Connectivity
    getStatus(localId, callback) {
        this.getState(localId, 'connected', callback);
    }

    // DimmableSwitch Implementation
    getDSBrightness(localId, callback) {
        this.getState(localId, 'ds_brightness', callback);
    }

    setDSBrightness(localId, value) {
        const bridge = this._getBridgeByLight(localId);
        if (!bridge)
            return;

        const brightness = Math.min(Math.max(normalize(value, 0, 100, 255), 0), 255);
        bridge.setState(localId, { bri: brightness });
    }

    stepDown(localId, value) {
        this.getDSBrightness(localId, current => {
            if (current === undefined)
                return;
            const step = value !== undefined ?
                Math.min(Math.max(value, 0), 100) :
                StepSize;
            this.setDSBrightness(localId, Math.max(current - step, 0));
        });
    }

    stepUp(localId, value) {
        this.getDSBrightness(localId, current => {
            if (current === undefined)
                return;
            const step = value !== undefined ?
                Math.min(Math.max(value, 0), 100) :
                StepSize;
            this.setDSBrightness(localId, Math.min(current + step, 100));
        });
    }

    // MulticolorLight Implementation
    getMclBrightness(localId, callback) {
        this.getState(localId, 'mcl_brightness', callback);
    }

    getHue(localId, callback) {
        this.getState(localId, 'hue', callback);
    }

    getSaturation(localId, callback) {
        this.getState(localId, 'sat', callback);
    }

    getTemperature(localId, callback) {
        this.getState(localId, 'ct', callback);
    }

    getTempLowerLimit(localId, callback) {
        const bridge = this._getBridgeByLight(localId);
        if (!bridge)
            return callback();

        callback(TempLower);
    }

    getTempUpperLimit(localId, callback) {
        const bridge = this._getBridgeByLight(localId);
        if (!bridge)
            return callback();

        callback(TempUpper);
    }

    setHue(localId, value) {
        const bridge = this._getBridgeByLight(localId);
        if (!bridge)
            return;

        bridge.setState(localId, { hue: +value });
    }

    setMclBrightness(localId, value) {
        const bridge = this._getBridgeByLight(localId);
        if (!bridge)
            return;

        const brightness = Math.min(Math.max(normalize(value, 0, 0xffff, 254), 0), 254);
        bridge.setState(localId, { bri: brightness });
    }

    setSaturation(localId, value) {
        const bridge = this._getBridgeByLight(localId);
        if (!bridge)
            return;

        const saturation = Math.min(Math.max(normalize(value, 0, 0xffff, 254), 0), 254);
        bridge.setState(localId, { sat: saturation });
    }

    setTemperature(localId, value) {
        const bridge = this._getBridgeByLight(localId);
        if (!bridge)
            return;

        const temperature = microReciprocal(value);
        bridge.setState(localId, { ct: temperature });
    }

}

const AppName = 'droplit#edge';

class Bridge extends EventEmitter {
    constructor(config) {
        super();

        this.address = config.location.host;
        this.bridge = {
            appName: AppName,
            type: 'hue'
        };
        this.key = crypto.createHash('md5').update(AppName).digest('hex');
        this.identifier = config.identifier;
        this.registered = null;
        this.deviceMeta = {
            customName: config.info.device.friendlyName,
            manufacturer: config.info.device.manufacturer,
            modelDescription: config.info.device.modelDescription,
            modelName: config.info.device.modelName,
            modelNumber: config.info.device.modelNumber
        };
        this.promotedMembers = {
            register: 'BasicAuthBridge.register'
        };
        this.services = [ 'BasicAuthBridge', 'Connectivity' ];

        this.lights = new Map();
    }

    static outputState(state) {
        return {
            ct: microReciprocal(state.ct),
            ds_brightness: normalize(state.bri, 0, 254),
            hue: state.hue,
            mcl_brightness: normalize(state.bri, 0, 254, 0xffff),
            on: !state.reachable ? 'off' :
                state.on ? 'on' : 'off',
            sat: normalize(state.sat, 0, 254, 0xffff),
            connected: state.reachable ? 'online' : 'offline'
        };
    }

    discoverObject() {
        return {
            localId: this.identifier,
            address: this.address,
            deviceMeta: this.deviceMeta,
            services: this.services,
            promotedMembers: this.promotedMembers
        };
    }

    getLightState(identifier, callback) {
        const light = this.lights.get(identifier);
        if (!light)
            return;

        const opts = {
            json: true,
            method: 'GET',
            timeout: 3000,
            url: `http://${this.address}/api/${this.key}/lights/${light.pathId}`
        };
        request(opts, (e, r, b) => {
            if (e) {
                if (callback)
                    callback(e); // eslint-disable-line callback-return
                return;
            }

            callback(null, b.state);
        });
    }

    getLights(callback) {
        const opts = {
            json: true,
            timeout: 3000,
            url: `http://${this.address}/api/${this.key}/lights`
        };
        request(opts, (e, r, b) => {
            if (e) {
                if (callback)
                    callback(e); // eslint-disable-line callback-return
                return;
            }

            // See if response is an error
            if (Array.isArray(b) && b[0].hasOwnProperty('error')) {
                if (this.registered === null || this.registered === true) {
                    this.registered = false;
                    this.emit('registered', this);
                }
                // App is not registered
                if (b[0].error.type === 1)
                    setImmediate(() => this.register.bind(this)());
                return;
            }

            if (!this.registered) {
                this.registered = true;
                this.emit('registered', this);
            }

            const deviceChanges = [];
            // New devices
            Object.keys(b).forEach(id => {
                const lightData = b[id];
                const identifier = Light.formatId(lightData.uniqueid);
                if (!this.lights.has(identifier)) {
                    const light = new Light(lightData, id);
                    this.lights.set(identifier, light);
                    this.emit('discovered', light);
                    deviceChanges.push({ light, changes: light.stateAsChanges() });
                    return;
                }

                const light = this.lights.get(identifier);
                const changes = [];
                [ 'on', 'bri', 'hue', 'sat', 'ct' ].forEach(state => {
                    if (lightData.state[state] !== light.state[state])
                        changes.push({ state, value: lightData.state[state] });
                });
                if (changes.length > 0)
                    deviceChanges.push({ light, changes });

                light.state = lightData.state;

                // TODO: May need to handle id changes
            });

            if (deviceChanges.length > 0)
                deviceChanges.forEach(dc =>
                    this.emit('state-changes', { light: dc.light, changes: dc.changes }));

            if (callback)
                return callback(e, b);
        });
    }

    propertyObject(service, member, value) {
        return {
            localId: this.identifier,
            service,
            member,
            value
        };
    }

    register(callback) {
        const opts = {
            json: {
                devicetype: AppName
            },
            method: 'POST',
            timeout: 3000,
            url: `http://${this.address}/api`
        };
        request(opts, (e, r, b) => {
            if (e) {
                if (callback)
                    callback(e); // eslint-disable-line callback-return
                return;
            }

            if (b[0].hasOwnProperty('error')) {
                // Link button not pressed
                if (b[0].error.type === 101) {
                    // TODO: Notify to press button
                    // console.log('User not authorized, press link button');
                }
                return;
            }

            if (b[0].hasOwnProperty('success')) {
                if (b[0].success.hasOwnProperty('username')) {
                    this.key = b[0].success.username;
                    this.emit('username', this);
                }
            }

            setImmediate(() => this.getLights.bind(this));
        });
    }

    setState(identifier, state, callback) {
        const light = this.lights.get(identifier);
        if (!light)
            return;

        const opts = {
            json: state,
            method: 'PUT',
            timeout: 3000,
            url: `http://${this.address}/api/${this.key}/lights/${light.pathId}/state`
        };
        request(opts, (e, r, b) => {
            if (e) {
                if (callback)
                    callback(e); // eslint-disable-line callback-return
                return;
            }

            const errors = [];
            const success = {};
            const changes = [];

            b.forEach(response => {
                if (response.error) {
                    errors.push(response.error);
                    return;
                }

                const stateRegex = new RegExp(`\/lights\/${light.pathId}\/state\/(.+)`);
                Object.keys(response.success).forEach(key => {
                    const stateName = stateRegex.exec(key)[1];
                    success[stateName] = response.success[key];
                    if (light.state[stateName] !== response.success[key]) {
                        changes.push({ state: stateName, value: response.success[key] });
                        light.state[stateName] = response.success[key];
                    }
                });
            });

            if (changes.length > 0)
                this.emit('state-changes', { light, changes });

            if (callback)
                return callback(errors, success);
        });
    }
}

class Light {
    constructor(config, pathId) {
        this.pathId = pathId;
        this.uniqueid = Light.formatId(config.uniqueid);
        this.name = config.name;
        this.type = config.type;
        this.modelid = config.modelid;
        this.manufacturername = config.manufacturername.trim();
        this.state = config.state;
    }

    static formatId(id) {
        return id.replace(/[:-]/g, '');
    }

    get outputState() {
        return Bridge.outputState(this.state);
    }

    get promotedMembers() {
        const members = {};
        if (this.services.some(s => s === 'BinarySwitch'))
            members.switch = 'BinarySwitch.switch';
        if (this.services.some(s => s === 'DimmableSwitch'))
            members.brightness = 'DimmableSwitch.brightness';
        return members;
    }

    get services() {
        switch (this.type) {
            case 'Extended color light':
            case 'Color light':
                return [ 'BinarySwitch', 'DimmableSwitch', 'LightColor', 'ColorTemperature', 'Connectivity' ];
            case 'Dimmable light':
            case 'Dimmable plug-in unit':
                return [ 'BinarySwitch', 'DimmableSwitch', 'Connectivity' ];
            default:
                return [ 'BinarySwitch', 'Connectivity' ];
        }
    }

    discoverObject() {
        return {
            localId: this.uniqueid,
            address: this.pathId,
            deviceMeta: {
                customName: this.name,
                manufacturer: this.manufacturername,
                modelName: this.type,
                modelNumber: this.modelid
            },
            services: this.services,
            promotedMembers: this.promotedMembers
        };
    }

    stateAsChanges() {
        const props = [];
        if (this.state.hasOwnProperty('on'))
            props.push({ state: 'on', value: this.state.on });
        if (this.state.hasOwnProperty('bri'))
            props.push({ state: 'bri', value: this.state.bri });
        if (this.state.hasOwnProperty('hue'))
            props.push({ state: 'hue', value: this.state.hue });
        if (this.state.hasOwnProperty('sat'))
            props.push({ state: 'sat', value: this.state.sat });
        if (this.state.hasOwnProperty('ct')) {
            props.push({ state: 'ct', value: this.state.ct });
            props.push({ state: 'temp_low', value: TempLower });
            props.push({ state: 'temp_high', value: TempUpper });
        }
        if (this.state.hasOwnProperty('reachable'))
            props.push({ state: 'connected', value: this.state.reachable ? 'online' : 'offline' });

        return props;
    }

    propertyObject(service, member, value) {
        return {
            localId: this.uniqueid,
            service,
            member,
            value
        };
    }
}

function microReciprocal(value) {
    return parseInt((1000000 / value).toString());
}

function normalize(value, min, max, mult) {
    mult = mult || 100;
    return Math.round(((value - min) / (max - min)) * mult);
}

module.exports = HuePlugin;
