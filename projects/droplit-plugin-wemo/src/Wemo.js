'use strict';

const Discoverer = require('./Discoverer');
const Clients = require('./WemoClient');

const droplit = require('droplit-plugin');

class WemoPlugin extends droplit.DroplitPlugin {
    constructor(config = {}) {
        super();

        this.config = config;

        this.devices = new Map();

        this.discoverer = new Discoverer();
        this.discoverer.on('discovered', onDiscovered.bind(this));
        this.discoverer.on('ipchange', onDiscoverIPChange.bind(this));

        /* eslint-disable camelcase */
        this.services = {
            BinarySwitch: {
                get_switch: this.getSwitch,
                set_switch: this.setSwitch,
                switchOff: this.switchOff,
                switchOn: this.switchOn
            },
            CoffeeMaker: {
                brew: this.brew,
                get_state: this.getState
            },
            MotionSensor: {}
        };
        /* es-lint-enable camelcase */

        this.eventsHandler = data => this.onEvents([data]);
        this.propertiesChangedHandler = data => this.onPropertiesChanged([data]);

        function onDiscovered(device) {
            if (this.devices.has(device.identifier))
                return;

            const client = Clients.WemoClient.create(device);
            client.on('event-raise', this.eventsHandler);
            client.on('prop-change', this.propertiesChangedHandler);
            this.devices.set(device.identifier, client);
            this.onDeviceInfo(client.discoverObject());
        }

        function onDiscoverIPChange(data) {
            const identifier = data.identifier;
            const address = data.ip.host;
            const client = this.devices.get(identifier);
            if (!client)
                return;
            client.address = address;
            this.onDeviceInfo({
                address,
                localId: identifier
            });
        }
    }

    discover() {
        this.discoverer.discover();
    }

    dropDevice(localId) {
        const device = this.devices.get(localId);
        if (!device)
            return false;

        const identifier = device.identifier;
        device.removeListener('event-raise', this.eventsHandler);
        device.removeListener('prop-change', this.propertiesChangedHandler);
        this.devices.delete(identifier);
        this.discoverer.undiscover(identifier);
    }

    pluginMessage(message, callback) {
        if (!this.config.diagnostics)
            return false;

        if (message === 'devices') {
            callback(Array.from(this.devices.keys()));
            return true;
        }

        if (message === 'help') {
            callback(['help', 'devices']);
            return true;
        }

        return false;
    }

    // BinarySwitch Implementation
    getSwitch(localId, callback) {
        const device = this.devices.get(localId);
        if (device && device.getState)
            device.getState((err, state) => {
                if (err)
                    return;
                callback(state ? 'on' : 'off');
            });
    }

    setSwitch(localId, value) {
        if (value === 'off')
            this.switchOff(localId);
        else if (value === 'on')
            this.switchOn(localId);
    }

    switchOff(localId) {
        const device = this.devices.get(localId);
        if (device && device.switchOff)
            device.switchOff(() => { });
    }

    switchOn(localId) {
        const device = this.devices.get(localId);
        if (device && device.switchOn)
            device.switchOn(() => { });
    }

    // CoffeeMaker Implementation
    brew(localId) {
        const device = this.devices.get(localId);
        if (device && device.brew)
            device.brew(() => { });
    }

    getState(localId, callback) {
        const device = this.devices.get(localId);
        if (device && device.getMode) {
            device.getMode((err, mode) => {
                if (err)
                    return;
                callback(mode);
            });
        }
    }
}

module.exports = WemoPlugin;
