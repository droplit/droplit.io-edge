'use strict';

const droplit = require('droplit-plugin');

class ExamplePlugin extends droplit.DroplitPlugin {

    constructor() {
        super();

        // virtual device states
        this.devices = {
            1: {
                'BinarySwitch.switch': 'off'
            },
            2: {
                'BinarySwitch.switch': 'off'
            }
        };

        /* eslint-disable camelcase */
        this.services = {
            BinarySwitch: {
                get_switch: this.BinarySwitch_get_switch,
                set_switch: this.BinarySwitch_set_switch
            }
        };
        /* es-lint-enable camelcase */

        setImmediate(() => {
            this.onDeviceInfo({
                localId: '1',
                address: 'device.1',
                deviceMeta: { name: 'first device' },
                location: 'main facility',
                name: 'device1',
                services: ['BinarySwitch'],
                promotedMembers: {
                    switch: 'BinarySwitch.switch'
                }
            });
        });
    }

    /**
     * Example plugin will produce two devices when told to discover
     */

    discover() {
        setImmediate(() => { // simulate async
            this.onDeviceInfo({
                localId: '1',
                address: 'device.1',
                deviceMeta: { name: 'first device' },
                location: 'main facility',
                name: 'device1',
                services: ['BinarySwitch'],
                promotedMembers: {
                    switch: 'BinarySwitch.switch'
                }
            });
            this.onDeviceInfo({
                localId: '2',
                address: 'device.2',
                deviceMeta: { name: 'second device' },
                location: 'main facility',
                name: 'device2',
                services: ['BinarySwitch'],
                promotedMembers: {
                    switch: 'BinarySwitch.switch'
                }
            });
            this.onDiscoverComplete();
        });
    }

    connect(localId) {
        // track state changes on this device
        this.deviceConnected[localId] = true;
    }

    disconnect(localId) {
        // stop tracking state changes on this device
        this.deviceConnected[localId] = false;
    }

    getStatus(localId, callback) {
        callback(this.devices[localId]['Connectivity.status']);
    }

    BinarySwitch_get_switch(localId, index, callback) {
        if (index === undefined) {
            setImmediate(() => { // simulate async
                // send last set value
                callback(this.devices[localId]['BinarySwitch.switch']);
            });
            return true;
        }
        return false;
    }

    BinarySwitch_set_switch(localId, index, value) {
        if (index === undefined) {
            setImmediate(() => { // simulate async
                // simulate setting device property
                this.devices[localId]['BinarySwitch.switch'] = value;
                // check if we're supposed to be tracking the device state
                if (this.deviceConnected[localId]) {
                    /**
                     * we have a connection to the device,
                     * so we would get a notification that the state changed
                     * indicate the property changed
                     */
                    this.onPropertiesChanged([{
                        localId,
                        index,
                        member: 'switch',
                        service: 'BinarySwitch',
                        value
                    }]);
                } else {
                    /**
                     * send command to device, but state change doesn't
                     * report back because the state is not being tracked
                     */
                }
            });
            return true;
        }
        return false;
    }
}

module.exports = ExamplePlugin;
