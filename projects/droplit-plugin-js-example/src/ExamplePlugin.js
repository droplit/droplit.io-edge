'use strict';

const droplit = require('droplit-plugin');

class ExamplePlugin extends droplit.DroplitPlugin {

    constructor() {
        super();

        // ensure connectivity ability is live
        this.connectActive = false;
        // virtual device states
        this.devices = {};

        /* eslint-disable camelcase */
        this.services = {
            BinarySwitch: {
                get_switch: this.getSwitch,
                set_switch: this.setSwitch,
                switchOff: this.switchOff,
                switchOn: this.switchOn
            },
            Connectivity: {
                connect: this.connect,
                disconnect: this.disconnect,
                get_status: this.getStatus
            }
        };
        /* es-lint-enable camelcase */
    }

    /**
     * Example plugin will produce two devices when told to discover
     */
    discover() {
        setImmediate(() => { // simulate async
            if (!this.devices[1]) {
                this.devices[1] = { 'BinarySwitch.switch': 'off' };
                this.onDeviceInfo({
                    localId: '1',
                    address: 'device.1',
                    deviceMeta: { name: 'first device' },
                    location: 'main facility',
                    name: 'device1',
                    services: ['BinarySwitch', 'Connectivity'],
                    promotedMembers: {
                        switch: 'BinarySwitch.switch'
                    }
                });
            }

            if (!this.devices[2]) {
                this.devices[2] = { 'BinarySwitch.switch': 'off' };
                this.onDeviceInfo({
                    localId: '2',
                    address: 'device.2',
                    deviceMeta: { name: 'second device' },
                    location: 'main facility',
                    name: 'device2',
                    services: ['BinarySwitch', 'Connectivity'],
                    promotedMembers: {
                        switch: 'BinarySwitch.switch'
                    }
                });
            }

            this.onDiscoverComplete();
        });
    }

    dropDevice(localId) {
        this.disconnect(localId);
        delete this.devices[localId];
        return true;
    }

    // BinarySwitch Implementation
    getSwitch(localId, callback) {
        // device does not exist
        if (!this.devices[localId]) {
            callback(undefined);
            return true;
        }

        setImmediate(() => { // simulate async
            // send last set value
            callback(this.devices[localId]['BinarySwitch.switch']);
        });
        return true;
    }

    setSwitch(localId, value) {
        // device does not exist
        if (!this.devices[localId])
            return true;

        // check if values are valid
        if (value !== 'on' && value !== 'off')
            return true;

        // simulate setting device property
        this.devices[localId]['BinarySwitch.switch'] = value;

        // check if we're supposed to be tracking the device state
        if (!this.connectActive || this.deviceConnected[localId]) {
            // send state change notification
            setImmediate(() => // simulate async
                this.onPropertiesChanged([{
                    localId,
                    index: '0',
                    member: 'switch',
                    service: 'BinarySwitch',
                    value
                }])
            );
        }
        return true;
    }

    switchOff(localId) {
        return this.setSwitch(localId, 'off');
    }

    switchOn(localId) {
        return this.setSwitch(localId, 'on');
    }

    // Connectivity Implementation
    connect(localId) {
        this.connectActive = true;
        // track state changes on this device
        this.deviceConnected[localId] = true;
        return true;
    }

    disconnect(localId) {
        // stop tracking state changes on this device
        this.deviceConnected[localId] = false;
        return true;
    }

    getStatus(localId, callback) {
        callback(this.devices[localId]['Connectivity.status']);
        return true;
    }
}

module.exports = ExamplePlugin;
