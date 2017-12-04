const Discoverer = require('./Discoverer');
const droplit = require('droplit-plugin');
const request = require('request-lite');
const EventEmitter = require('events').EventEmitter;

const PollInterval = 1000 * 10; // in ms
const StepSize = 10;
const TempLower = 1200; // in Kelvins
const TempUpper = 6500; // in Kelvins

class Nanoleaf extends droplit.DroplitPlugin {
    constructor(config = {}) {
        super();

        this.config = config;

        this.controllers = new Map();

        this.discoverer = new Discoverer();
        this.discoverer.on('discovered', onDiscovered.bind(this));
        this.discoverer.on('ipchange', onDiscoverIPChange.bind(this));

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
                get_temperatureMin: this.getTempMin,
                get_temperatureMax: this.getTempMax,
                set_temperature: this.setTemperature
            },
            DimmableSwitch: {
                get_brightness: this.getDSBrightness,
                set_brightness: this.setDSBrightness,
                stepDown: this.stepDown,
                stepUp: this.stepUp
            },
            Indicator: {
                blink: this.blink
            },
            LightColor: {
                get_brightness: this.getLcBrightness,
                get_hue: this.getHue,
                get_saturation: this.getSaturation,
                set_brightness: this.setLcBrightness,
                set_hue: this.setHue,
                set_saturation: this.setSaturation
            }
        };
        /* es-lint-enable camelcase */

        setInterval(() => {
            if (this.controllers.size === 0)
                return;

            for (const controller of this.controllers.values())
                controller.getInfo();
        }, PollInterval);

        function onDiscovered(data) {
            const identifier = data.identifier;
            let controller = this.controllers.get(identifier);
            if (controller !== undefined)
                return;

            controller = new Controller(data);
            controller.on('registered', onRegistered.bind(this));
            controller.on('state-changes', onStateChanges.bind(this));
            controller.on('update', onUpdate.bind(this));

            this.controllers.set(identifier, controller);
            this.onDeviceInfo(controller.discoverObject(), info => {
                if (info.deviceMeta && info.deviceMeta.hasOwnProperty('edgeData') && info.deviceMeta.edgeData.hasOwnProperty('authtoken')) {
                    controller.authToken = info.deviceMeta.edgeData.authtoken;
                    controller.getInfo();
                }
            });
        }

        function onDiscoverIPChange(data) {
            const identifier = data.identifier;
            const address = data.ip.host;
            const controller = this.controllers.get(identifier);
            if (!controller)
                return;

            controller.host = address;
            this.onDeviceInfo({
                address,
                localId: identifier
            });
        }

        function onRegistered(controller) {
            this.onDeviceInfo(controller.discoverObject());
            this.onPropertiesChanged([controller.propertyObject('BasicAuthBridge', 'authenticated', controller.registered)]);
        }

        function onStateChanges(data) {
            const output = Controller.outputState(data.controller.state);
            const changes = data.changes.reduce((p, c) => {
                if (c.name === 'brightness') {
                    p.push(data.controller.propertyObject('DimmableSwitch', 'brightness', output.ds_brightness));
                    p.push(data.controller.propertyObject('LightColor', 'brightness', output.lc_brightness));
                }

                if (c.name === 'ct') {
                    p.push(data.controller.propertyObject('ColorTemperature', 'temperature', output.ct));
                    p.push(data.controller.propertyObject('ColorTemperature', 'temperatureMax', TempUpper));
                    p.push(data.controller.propertyObject('ColorTemperature', 'temperatureMin', TempLower));
                }

                if (c.name === 'hue')
                    p.push(data.controller.propertyObject('LightColor', 'hue', output.hue));

                if (c.name === 'on')
                    p.push(data.controller.propertyObject('BinarySwitch', 'switch', output.on));

                if (c.name === 'sat')
                    p.push(data.controller.propertyObject('LightColor', 'saturation', output.sat));

                return p;
            }, []);

            if (changes.length > 0)
                this.onPropertiesChanged(changes);
        }

        function onUpdate(controller) {
            this.onDeviceInfo(controller.discoverObject());
        }
    }

    discover() {
        this.discoverer.discover();
    }

    dropDevice(localId) {
        const controller = this.controllers.get(localId);
        if (!controller)
            return;

        controller.unregister();
        controller.removeAllListeners('registered');
        controller.removeAllListeners('ipchange');

        this.controllers.delete(localId);
        this.discoverer.undiscover(localId);
    }

    // BasicAuthBridge Implementation
    getAuthenticated(localId, callback) {
        const controller = this.controllers.get(localId);
        if (!controller)
            return callback();

        callback(controller.registered);
    }

    register(localId) {
        const controller = this.controllers.get(localId);
        if (!controller)
            return;

        controller.register();
    }

    // BinarySwitch Implementation
    getSwitch(localId, callback) {
        const controller = this.controllers.get(localId);
        if (!controller)
            return callback();

        controller.getState('on', value =>
            callback(value ? 'on' : 'off'));
    }

    setSwitch(localId, value) {
        if (value === 'off')
            this.switchOff(localId);
        else if (value === 'on')
            this.switchOn(localId);
    }

    switchOff(localId) {
        const controller = this.controllers.get(localId);
        if (!controller)
            return;

        controller.setState({ on: { value: false } });
    }

    switchOn(localId) {
        const controller = this.controllers.get(localId);
        if (!controller)
            return;

        controller.setState({ on: { value: true } });
    }

    // ColorTemperature
    getTemperature(localId, callback) {
        const controller = this.controllers.get(localId);
        if (!controller)
            return callback();

        controller.getState('ct', value => callback(+value));
    }

    getTempMax(localId, callback) {
        const controller = this.controllers.get(localId);
        if (!controller)
            return callback();
        callback(TempUpper);
    }

    getTempMin(localId, callback) {
        const controller = this.controllers.get(localId);
        if (!controller)
            return callback();
        callback(TempLower);
    }

    setTemperature(localId, value) {
        const controller = this.controllers.get(localId);
        if (!controller)
            return;

        value = +value;
        controller.setState({ ct: { value } });
    }

    // DimmableSwitch Implementation
    getDSBrightness(localId, callback) {
        const controller = this.controllers.get(localId);
        if (!controller)
            return callback();

        controller.getState('brightness', value => callback(+value));
    }

    setDSBrightness(localId, value) {
        const controller = this.controllers.get(localId);
        if (!controller)
            return;

        value = +value;
        controller.setState({ brightness: { value } });
    }

    stepDown(localId) {
        const controller = this.controllers.get(localId);
        if (!controller)
            return;

        controller.setState({ brightness: { increment: -StepSize } });
    }

    stepUp(localId) {
        const controller = this.controllers.get(localId);
        if (!controller)
            return;

        controller.setState({ brightness: { increment: +StepSize } });
    }

    // Indicator implementation
    blink(localId) {
        const controller = this.controllers.get(localId);
        if (!controller)
            return;

        controller.identify();
    }

    // LightColor Implementation
    getHue(localId, callback) {
        const controller = this.controllers.get(localId);
        if (!controller)
            return callback();

        controller.getState('hue', value =>
            callback(normalize(value, 0, 360, 0xFFFF)));
    }

    getLcBrightness(localId, callback) {
        const controller = this.controllers.get(localId);
        if (!controller)
            return callback();

        controller.getState('brightness', value =>
            callback(normalize(value, 0, 100, 0xFFFF)));
    }

    getSaturation(localId, callback) {
        const controller = this.controllers.get(localId);
        if (!controller)
            return callback();

        controller.getState('sat', value =>
            callback(normalize(value, 0, 100, 0xFFFF)));
    }

    setHue(localId, value) {
        const controller = this.controllers.get(localId);
        if (!controller)
            return;

        value = Math.min(Math.max(normalize(+value, 0, 0xFFFF, 360)));
        controller.setState({ hue: { value } });
    }

    setLcBrightness(localId, value) {
        const controller = this.controllers.get(localId);
        if (!controller)
            return;

        value = Math.min(Math.max(normalize(+value, 0, 0xFFFF)));
        controller.setState({ brightness: { value } });
    }

    setSaturation(localId, value) {
        const controller = this.controllers.get(localId);
        if (!controller)
            return;

        value = Math.min(Math.max(normalize(+value, 0, 0xFFFF)));
        controller.setState({ sat: { value } });
    }
}

class Controller extends EventEmitter {
    constructor(config) {
        super();

        this.host = config.location.host;
        this.identifier = config.identifier;

        this.deviceMeta = {
            name: config.name,
            manufacturer: 'Nanoleaf'
        };
        this.registered = null;
        this.services = [
            'BasicAuthBridge',
            'BinarySwitch',
            'DimmableSwitch',
            'Indicator',
            'LightColor'
        ];
        this.state = {};
    }

    static outputState(state) {
        return {
            ct: state.ct.value,
            ds_brightness: state.brightness.value,
            hue: normalize(state.hue.value, 0, 360, 0xFFFF),
            lc_brightness: normalize(state.brightness.value, 0, 100, 0xFFFF),
            on: state.on.value ? 'on' : 'off',
            sat: normalize(state.sat.value, 0, 100, 0xFFFF)
        };
    }

    get authToken() {
        if (!this.deviceMeta.edgeData)
            return undefined;

        return this.deviceMeta.edgeData.authtoken;
    }

    set authToken(value) {
        if (!this.deviceMeta.edgeData)
            this.deviceMeta.edgeData = {};
        this.deviceMeta.edgeData.authtoken = value;
    }

    discoverObject() {
        const obj = {
            localId: this.identifier,
            address: this.host,
            deviceMeta: this.deviceMeta,
            services: this.services
        };

        // Avoid clearing authtoken on initial discovery
        if (obj.deviceMeta.edgeData && Object.keys(obj.deviceMeta.edgeData).length === 0)
            delete obj.deviceMeta.edgeData;

        return obj;
    }

    getInfo() {
        if (!this.authToken)
            return;

        const opts = {
            json: true,
            method: 'GET',
            timeout: 3000,
            url: `http://${this.host}/api/v1/${this.authToken}`
        };
        request(opts, (e, r, b) => {
            if (e || !b)
                return;

            let infoChange = false;
            if (b.name && (b.name !== this.deviceMeta.customName)) {
                this.deviceMeta.customName = b.name;
                infoChange = true;
            }

            if (b.manufacturer && (b.manufacturer !== this.deviceMeta.manufacturer)) {
                this.deviceMeta.manufacturer = b.manufacturer;
                infoChange = true;
            }

            if (b.model && (b.model !== this.deviceMeta.modelNumber)) {
                this.deviceMeta.modelNumber = b.model;
                infoChange = true;
            }

            if (infoChange)
                this.emit('update', this);

            if (b.state) {
                const changes = [];
                ['brightness', 'ct', 'hue', 'on', 'sat'].forEach(name => {
                    if (!this.state[name])
                        this.state[name] = {};

                    if (!this.state[name].hasOwnProperty('value') || (b.state[name].value !== this.state[name].value)) {
                        changes.push({ name, value: b.state[name].value });
                        this.state[name].value = b.state[name].value;
                    }
                });

                if (changes.length > 0)
                    this.emit('state-changes', { controller: this, changes });
            }
        });
    }

    getState(name, callback) {
        if (!this.authToken || !name)
            return callback();

        const opts = {
            json: true,
            method: 'GET',
            timeout: 3000,
            url: `http://${this.host}/api/v1/${this.authToken}/state/${name}`
        };
        request(opts, (e, r, b) => {
            if (e)
                return callback();

            callback(b.value);
        });
    }

    identify() {
        if (!this.authToken)
            return;

        const opts = {
            method: 'PUT',
            timeout: 3000,
            url: `http://${this.host}/api/v1/${this.authToken}/identify`
        };
        request(opts);
    }

    propertyObject(service, member, value) {
        return {
            localId: this.identifier,
            service,
            member,
            value
        };
    }

    register() {
        const opts = {
            json: true,
            method: 'POST',
            timeout: 3000,
            url: `http://${this.host}/api/v1/new`
        };
        request(opts, (e, r, b) => {
            if (e)
                return;

            // Nanoleaf registration only valid under pairing mode via button press
            if (r.statusCode !== 200)
                return;

            if (b && b.auth_token) {
                this.authToken = b.auth_token;
                this.registered = true;

                this.emit('registered', this);

                setImmediate(this.getInfo.bind(this));
            }
        });
    }

    setState(value) {
        if (!this.authToken)
            return;

        const opts = {
            json: value,
            method: 'PUT',
            timeout: 3000,
            url: `http://${this.host}/api/v1/${this.authToken}/state`
        };

        request(opts, (e, r) => {
            if (e)
                return;

            // Only success case
            if (r.statusCode !== 204)
                return;

            const changes = [];
            Object.keys(value).forEach(name => {
                const propValue = value[name].hasOwnProperty('increment') ?
                    Math.min(Math.max(this.state[name].value + value[name].increment, 0), 100) :
                    value[name].value;

                if (this.state[name] && (propValue !== this.state[name].value)) {
                    changes.push({ name, value: propValue });
                    this.state[name].value = propValue;
                }
            });

            if (changes.length > 0)
                this.emit('state-changes', { controller: this, changes });
        });
    }

    unregister() {
        if (!this.authToken)
            return;

        const opts = {
            method: 'DELETE',
            timeout: 3000,
            url: `http://${this.host}/api/v1/${this.authToken}`
        };
        request(opts);
    }
}

function normalize(value, min, max, mult) {
    mult = mult || 100;
    return Math.round(((value - min) / (max - min)) * mult);
}

module.exports = Nanoleaf;