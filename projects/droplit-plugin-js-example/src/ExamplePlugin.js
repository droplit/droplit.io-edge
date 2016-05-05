"use strict";

import * as droplit from 'droplit-plugin';

class ExamplePlugin extends droplit.DroplitPlugin {
    
    constructor() {
        super();
        
        // virtual device states
        this.devices = {
            '1': {
                'BinarySwitch.switch': 'off'
            },
            '2': {
                'BinarySwitch.switch': 'off'
            }
        };
        
        // virtual device tracking
        let deviceConnected = {};
    }
    
    /**
     * Example plugin will produce two devices when told to discover
     */
    
    discover() {
        setImmediate(() => { // simulate async
            this.onDeviceUpdate({
                identifier: '1',
                address: 'device.1',
                deviceMeta: { name: 'first device'},
                location: 'main facility',
                name:  'device1',
                services: ['BinarySwitch'],
                promotedMembers: {
                    'switch': 'BinarySwitch.switch'
                }
            });
            this.onDeviceUpdate({
                identifier: '2',
                address: 'device.2',
                deviceMeta: { name: 'second device'},
                location: 'main facility',
                name:  'device2',
                services: ['BinarySwitch'],
                promotedMembers: {
                    'switch': 'BinarySwitch.switch'
                }
            });
            this.onDiscoverComplete();
        });
    }
    
    connect(identifier) {
        // track state changes on this device
        this.deviceConnected[identifier] = true;
    }
    
    disconnect(identifier) {
        // stop tracking state changes on this device
        this.deviceConnected[identifier] = false;
    }
    
    BinarySwitch_get_switch(identifier, index, callback) {
        if (index === undefined) {
            setImmediate(() => { // simulate async
                // send last set value
                callback(this.devices[identifier]['BinarySwitch.switch']);
            });
            return true;
        }
        return false;
    }
    
    BinarySwitch_set_switch(identifier, index, value) {
        if (index === undefined) {
            setImmediate(() => { // simulate async
                // simulate setting device property
                this.devices[identifier]['BinarySwitch.switch'] = value;
                // check if we're supposed to be tracking the device state
                if (this.deviceConnected[identifier]) {
                    /**
                     * we have a connection to the device,
                     * so we would get a notification that the state changed
                     * indicate the property changed
                     */
                    this.onPropertiesChanged([{
                        identifier: identifier,
                        index: index,
                        member: 'switch',
                        service: 'BinarySwitch',
                        value: value
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